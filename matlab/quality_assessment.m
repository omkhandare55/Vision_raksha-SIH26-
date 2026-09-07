function [quality_score, quality_decision, enhanced_img, feedback] = quality_assessment(img_path)
%QUALITY_ASSESSMENT Performs Image Quality Assessment and Enhancement on fundus images
%   [quality_score, quality_decision, enhanced_img, feedback] = quality_assessment(img_path)
%
%   Inputs:
%       img_path - Path to the fundus image file
%   Outputs:
%       quality_score    - Numeric score between 0 and 1
%       quality_decision - 'ACCEPT', 'ENHANCE', or 'REJECT'
%       enhanced_img     - Enhanced image matrix (if ACCEPT or ENHANCE, else empty)
%       feedback         - Structured feedback string for rejected images

    % Initialize outputs
    quality_score = 0;
    quality_decision = 'REJECT';
    enhanced_img = [];
    feedback = '';
    
    % Try to read the image
    try
        img = imread(img_path);
    catch ME
        feedback = 'Error: Cannot read image file. Please check the file path and format.';
        return;
    end
    
    % Ensure image is RGB
    if size(img, 3) ~= 3
        feedback = 'Error: Image must be an RGB image.';
        return;
    end
    
    % Convert to double for processing
    img_d = im2double(img);
    
    %% 1. Retinal Coverage Check
    % Create a retinal mask based on pixel intensity (non-black pixels > 15/255)
    gray_img = rgb2gray(img);
    retinal_mask = gray_img > (15/255);
    coverage_ratio = sum(retinal_mask(:)) / numel(retinal_mask);
    
    if coverage_ratio < 0.35
        feedback = 'Image rejected: Insufficient retinal coverage. Please ensure the pupil is properly dilated and the camera is aligned.';
        return; % Immediate reject
    end
    
    %% 2. Fundus Hue Validation (Reject selfies/external photos)
    % Convert to HSV space
    hsv_img = rgb2hsv(img);
    H = hsv_img(:,:,1);
    S = hsv_img(:,:,2);
    
    % Check red-orange hue: H in [0, 25/360] U [170/360, 1] with S > 0.3
    hue_mask = ((H >= 0 & H <= 25/360) | (H >= 170/360 & H <= 1)) & (S > 0.3);
    hue_ratio = sum(hue_mask(:)) / numel(hue_mask);
    
    if hue_ratio <= 0.35
        feedback = 'Image rejected: Invalid fundus hue detected. The image does not appear to be a proper retinal fundus photograph.';
        return; % Immediate reject
    end
    
    %% 3. Brightness Check
    % Compute mean pixel brightness on retinal mask
    % Original pixel values are 0-255, we use 0-1 for double, so threshold is 12/255 and 240/255
    mean_brightness = mean(gray_img(retinal_mask));
    
    brightness_score = 1.0;
    if mean_brightness < (12/255)
        feedback = 'Image rejected: Image is too dark. Please increase flash intensity or room lighting.';
        return;
    elseif mean_brightness > (240/255)
        feedback = 'Image rejected: Image is overexposed/too bright. Please decrease flash intensity.';
        return;
    end
    % Optional: Scale brightness score if it's near the boundaries
    if mean_brightness < 40/255 || mean_brightness > 200/255
        brightness_score = 0.6;
    end
    
    %% 4. Focus Check (Laplacian Variance)
    % Compute Laplacian variance
    lap = fspecial('laplacian');
    lap_filter = imfilter(gray_img, lap, 'replicate');
    focus_variance = var(lap_filter(retinal_mask));
    
    % Threshold is 25 in 0-255 scale, which is roughly 25/(255^2) in 0-1 scale
    % Since gray_img is 0-1, the variance is scaled by 1/(255^2).
    % Let's compute it in 0-255 scale for exact thresholding:
    gray_img_255 = double(rgb2gray(img));
    lap_filter_255 = imfilter(gray_img_255, lap, 'replicate');
    focus_variance_255 = var(lap_filter_255(retinal_mask));
    
    focus_score = 1.0;
    if focus_variance_255 < 25
        focus_score = 0.2;
        feedback = 'Image rejected: Image is out of focus or blurred. Please refocus the camera and ask the patient to keep their eye still.';
    elseif focus_variance_255 < 50
        focus_score = 0.6;
    end
    
    %% Calculate Final Quality Score
    % Base quality score on focus, brightness, and coverage
    quality_score = focus_score * 0.5 + brightness_score * 0.3 + coverage_ratio * 0.2;
    
    %% Decision Logic
    if focus_variance_255 < 25
        quality_score = min(quality_score, 0.4); % Cap if blurry
    end
    
    if quality_score >= 0.8
        quality_decision = 'ACCEPT';
    elseif quality_score >= 0.5
        quality_decision = 'ENHANCE';
    else
        quality_decision = 'REJECT';
    end
    
    %% Enhancement Pipeline (for ENHANCE or ACCEPT)
    if strcmp(quality_decision, 'ACCEPT') || strcmp(quality_decision, 'ENHANCE')
        % Convert to LAB for luminance processing
        lab_img = rgb2lab(img);
        L = lab_img(:,:,1) / 100; % Scale L to [0,1] for adapthisteq
        
        % 1. CLAHE via adapthisteq on L channel
        L_clahe = adapthisteq(L, 'NumTiles', [8 8], 'ClipLimit', 0.01);
        
        % 2. Adaptive gamma correction via imadjust
        L_gamma = imadjust(L_clahe);
        
        lab_img(:,:,1) = L_gamma * 100; % Scale back
        img_enhanced_rgb = lab2rgb(lab_img);
        
        % 3. Bilateral-like denoising via imgaussfilt (edge-preserving pseudo-bilateral)
        img_denoised = imgaussfilt(img_enhanced_rgb, 0.5);
        
        % 4. Unsharp masking via imsharpen
        enhanced_img = imsharpen(img_denoised, 'Radius', 1.5, 'Amount', 1.2);
        
        if isempty(feedback) && strcmp(quality_decision, 'ENHANCE')
            feedback = 'Image enhanced: Contrast and sharpness improved for better screening.';
        elseif isempty(feedback) && strcmp(quality_decision, 'ACCEPT')
            feedback = 'Image accepted: Good quality.';
        end
    end
end
