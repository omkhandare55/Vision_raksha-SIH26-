function [grade, confidence, probabilities, raw_score] = grade_dr(img_path, model_path)
%GRADE_DR Grading Diabetic Retinopathy severity from retinal fundus images.
%
% [grade, confidence, probabilities, raw_score] = grade_dr(img_path, model_path)
%
% Inputs:
%   img_path   - Path to the input retinal image
%   model_path - (Optional) Path to the trained DL model (ONNX or PTH)
%
% Outputs:
%   grade         - Predicted DR severity grade (0 to 4)
%                   0: No DR, 1: Mild NPDR, 2: Moderate NPDR, 
%                   3: Severe NPDR, 4: Proliferative DR
%   confidence    - Clinical confidence score in percentage (50-100%)
%   probabilities - 1x5 array of probabilities for each grade
%   raw_score     - Continuous raw score before discretization
%
% This function implements a robust inference pipeline for DR screening
% including test-time augmentation, Ben Graham preprocessing, and 
% fallback to a rule-based expert system based on segmentation.

    if nargin < 2
        model_path = '';
    end

    % Load Image
    try
        img = imread(img_path);
    catch
        error('Failed to read image at %s', img_path);
    end
    
    % Attempt to load Deep Learning Model
    net = [];
    is_model_loaded = false;
    if ~isempty(model_path) && exist(model_path, 'file')
        try
            net = importONNXNetwork(model_path, 'OutputLayerType', 'regression');
            is_model_loaded = true;
        catch
            try
                % Attempt PyTorch fallback if ONNX fails
                net = importNetworkFromPyTorch(model_path);
                is_model_loaded = true;
            catch
                warning('Failed to load model from %s. Falling back to rule-based grading.', model_path);
            end
        end
    else
        warning('No model path provided or file does not exist. Falling back to rule-based grading.');
    end
    
    if is_model_loaded
        % Deep Learning Pipeline
        try
            [grade, confidence, probabilities, raw_score] = dl_grading_pipeline(img, net);
        catch ME
            warning('DL inference failed: %s. Falling back to rule-based grading.', ME.message);
            [grade, confidence, probabilities, raw_score] = rule_based_grading(img);
        end
    else
        % Rule-based fallback Pipeline
        [grade, confidence, probabilities, raw_score] = rule_based_grading(img);
    end
end

function [grade, confidence, probabilities, raw_score] = dl_grading_pipeline(img, net)
    % Preprocessing
    processed_img = preprocess_retina(img);
    
    % Test-Time Augmentation (TTA)
    imgs_tta = cell(1, 4);
    imgs_tta{1} = processed_img; % Original
    imgs_tta{2} = fliplr(processed_img); % Horizontal flip
    imgs_tta{3} = flipud(processed_img); % Vertical flip
    imgs_tta{4} = fliplr(flipud(processed_img)); % Both flips
    
    preds = zeros(1, 4);
    for i = 1:4
        % DL predict - assumes regression output
        % Adjust input dimensions format as required by the specific imported network (e.g. dlarray)
        input_dl = dlarray(single(imgs_tta{i}), 'SSC');
        pred_out = predict(net, input_dl);
        preds(i) = extractdata(pred_out);
    end
    
    % Average predictions
    raw_score = mean(preds);
    
    % Discretize grade based on thresholds
    thresholds = [0.6, 1.5, 2.5, 3.5];
    grade = sum(raw_score > thresholds);
    grade = min(max(grade, 0), 4);
    
    % Confidence Calculation (boundary distance)
    dist_to_bounds = abs(raw_score - [0, thresholds, 4]);
    min_dist = min(dist_to_bounds);
    confidence = 50 + 47 * (1 - exp(-min_dist * 2));
    
    % Probability Distribution (temperature-scaled softmax)
    T = 1.5;
    centers = 0:4;
    dists = -abs(raw_score - centers);
    exp_dists = exp(dists / T);
    probabilities = exp_dists / sum(exp_dists);
end

function processed_img = preprocess_retina(img)
    % Ben Graham Preprocessing exactly matching Python training
    
    % Ensure image is double for processing
    img_d = double(img);
    
    % 1. Circle Crop (scale = 0.9)
    [h, w, ~] = size(img_d);
    center_y = h / 2;
    center_x = w / 2;
    radius = min(h, w) / 2 * 0.9;
    [X, Y] = meshgrid(1:w, 1:h);
    mask = ((X - center_x).^2 + (Y - center_y).^2) <= radius^2;
    img_masked = img_d .* mask;
    
    % 2. Ben Graham enhancement
    % imsubtract(immultiply(img,4), immultiply(imgaussfilt(img, 10),4)) + 128
    blurred = imgaussfilt(img_masked, 10);
    enhanced = (img_masked * 4) - (blurred * 4) + 128;
    
    % Re-apply mask to keep background zero and clip values
    enhanced = enhanced .* mask;
    enhanced = min(max(enhanced, 0), 255);
    enhanced = uint8(enhanced);
    
    % 3. Resize to 456x456
    resized = imresize(enhanced, [456, 456]);
    
    % 4. Normalize with ImageNet stats
    img_norm = double(resized) / 255.0;
    mean_imgNet = reshape([0.485, 0.456, 0.406], 1, 1, 3);
    std_imgNet = reshape([0.229, 0.224, 0.225], 1, 1, 3);
    
    processed_img = (img_norm - mean_imgNet) ./ std_imgNet;
end

function [grade, confidence, probabilities, raw_score] = rule_based_grading(img)
    % Fallback grading based on morphological segmentation features
    
    % Call segmentation
    try
        seg = segment_retina(img);
        ma_count = seg.microaneurysms.count;
        hem_mask = seg.hemorrhages.mask;
        hem_count = seg.hemorrhages.dot_count + seg.hemorrhages.blot_count + seg.hemorrhages.flame_count;
        hem_area = seg.hemorrhages.area_fraction;
        ex_count = seg.exudates.count;
        neo_detected = seg.neovascularization.flag;
    catch
        warning('segment_retina failed or missing. Returning default features.');
        ma_count = 0;
        hem_mask = zeros(size(img,1), size(img,2));
        hem_count = 0;
        hem_area = 0;
        ex_count = 0;
        neo_detected = false;
    end
    
    % Check hemorrhages in quadrants (Simplified heuristic)
    [h, w] = size(hem_mask);
    quads = [
        sum(sum(hem_mask(1:floor(h/2), 1:floor(w/2)))),
        sum(sum(hem_mask(1:floor(h/2), floor(w/2)+1:end))),
        sum(sum(hem_mask(floor(h/2)+1:end, 1:floor(w/2)))),
        sum(sum(hem_mask(floor(h/2)+1:end, floor(w/2)+1:end)))
    ];
    hem_quadrants = sum(quads > 0);
    
    % Rule-based Logic
    if neo_detected || ma_count > 50
        grade = 4;
        raw_score = 4.0;
    elseif hem_area > 0.02 || hem_quadrants >= 3 || ma_count > 20
        grade = 3;
        raw_score = 3.0;
    elseif ma_count > 5 || ex_count > 0 || hem_count > 0
        grade = 2;
        raw_score = 2.0;
    elseif ma_count >= 1 && ma_count <= 5 && hem_count == 0 && ex_count == 0
        grade = 1;
        raw_score = 1.0;
    else
        grade = 0;
        raw_score = 0.0;
    end
    
    confidence = 65.0; % Lower confidence for fallback
    
    probabilities = zeros(1, 5);
    probabilities(grade + 1) = 0.7;
    probabilities(max(1, grade)) = probabilities(max(1, grade)) + 0.15;
    probabilities(min(5, grade + 2)) = probabilities(min(5, grade + 2)) + 0.15;
    probabilities = probabilities / sum(probabilities); % Normalize
end
