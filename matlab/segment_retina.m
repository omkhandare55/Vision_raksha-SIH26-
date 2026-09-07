function [results] = segment_retina(img_path)
%SEGMENT_RETINA Performs comprehensive retinal structure segmentation
%   [results] = segment_retina(img_path)
%
%   Inputs:
%       img_path - Path to the fundus image file
%   Outputs:
%       results - Struct containing all segmentation metrics and findings

    % Initialize results struct
    results = struct();
    results.status = 'SUCCESS';
    
    try
        if ischar(img_path) || isstring(img_path)
            img = imread(img_path);
        elseif isnumeric(img_path)
            img = img_path;
        else
            error('Invalid image input format');
        end
    catch
        results.status = 'ERROR';
        results.message = 'Could not read image file or matrix';
        return;
    end
    
    [h, w, ~] = size(img);
    gray_img = rgb2gray(img);
    
    %% 1. Optic Disc Localization
    % Apply CLAHE enhancement
    clahe_gray = adapthisteq(gray_img, 'ClipLimit', 0.02);
    
    % Radius search range: [h/20, h/6]
    rmin = max(10, floor(h/20));
    rmax = floor(h/6);
    
    % Find bright circular objects
    [centers, radii, metric] = imfindcircles(clahe_gray, [rmin rmax], 'ObjectPolarity', 'bright', 'Sensitivity', 0.9);
    
    if ~isempty(centers)
        od_center = centers(1, :);
        od_radius = radii(1);
    else
        % Fallback if Hough transform fails - use brightest region
        smoothed = imgaussfilt(double(gray_img), 10);
        [~, max_idx] = max(smoothed(:));
        [cy, cx] = ind2sub(size(smoothed), max_idx);
        od_center = [cx, cy];
        od_radius = h/15; % Guess
    end
    
    results.optic_disc.center = od_center;
    results.optic_disc.radius = od_radius;
    
    %% 2. Fovea Estimation
    % Anatomical rule: 2.5x OD diameter temporal from OD center
    % Determine temporal direction. If OD is left of center, fovea is to the right.
    img_center_x = w / 2;
    if od_center(1) < img_center_x
        % OD is on the left, fovea on the right
        dir_x = 1;
    else
        % OD is on the right, fovea on the left
        dir_x = -1;
    end
    
    fovea_dist = 2.5 * (2 * od_radius);
    fovea_x = od_center(1) + dir_x * fovea_dist;
    fovea_y = od_center(2); % roughly same horizontal level
    
    % Constrain to image boundaries
    fovea_x = max(1, min(w, fovea_x));
    
    results.fovea.center = [fovea_x, fovea_y];
    
    %% 3. Vessel Segmentation (Multi-Scale Frangi)
    % Use green channel
    green_ch = img(:,:,2);
    green_clahe = adapthisteq(green_ch);
    green_double = im2double(green_clahe);
    
    sigmas = [1.0, 1.5, 2.0, 3.0];
    vesselness = zeros(h, w);
    
    for s = sigmas
        % Compute Hessian
        g_smoothed = imgaussfilt(green_double, s);
        [Gx, Gy] = imgradientxy(g_smoothed);
        [Dxx, Dxy] = imgradientxy(Gx);
        [Dyx, Dyy] = imgradientxy(Gy); % Dyx is ~Dxy
        
        % Calculate vesselness
        for y = 1:h
            for x = 1:w
                H = [Dxx(y,x) Dxy(y,x); Dxy(y,x) Dyy(y,x)];
                lambda = eig(H);
                % Sort by magnitude
                [~, idx] = sort(abs(lambda));
                l1 = lambda(idx(1));
                l2 = lambda(idx(2));
                
                if l2 > 0 % Dark vessels
                    Rb = (l1 / l2)^2;
                    S = l1^2 + l2^2;
                    v = exp(-Rb/0.5) * (1 - exp(-S/1.0));
                    vesselness(y,x) = max(vesselness(y,x), v);
                end
            end
        end
    end
    
    vessel_mask = vesselness > 0.15;
    
    % Metrics
    cc_vessels = bwconncomp(vessel_mask);
    results.vessel.density = sum(vessel_mask(:)) / (h*w);
    results.vessel.branch_count = cc_vessels.NumObjects;
    % Tortuosity - simplified mock metric for this scope
    results.vessel.tortuosity_index = results.vessel.branch_count / (results.vessel.density * 1000 + 1);
    results.vessel.mask = vessel_mask;
    
    %% 4. Microaneurysm Detection
    inv_green = imcomplement(im2double(green_ch));
    thresh_5 = prctile(inv_green(:), 95);
    ma_candidates = inv_green > thresh_5;
    
    ma_opened = imopen(ma_candidates, strel('disk', 2));
    
    % Filter by area and remove vessel overlap
    ma_props = regionprops(ma_opened, 'Area', 'Centroid', 'PixelIdxList');
    ma_mask = false(h, w);
    ma_centroids = [];
    
    for i = 1:length(ma_props)
        area = ma_props(i).Area;
        if area >= 5 && area <= 80
            % Check vessel overlap
            overlap = sum(vessel_mask(ma_props(i).PixelIdxList));
            if overlap == 0
                ma_mask(ma_props(i).PixelIdxList) = true;
                ma_centroids = [ma_centroids; ma_props(i).Centroid];
            end
        end
    end
    
    results.microaneurysms.count = size(ma_centroids, 1);
    results.microaneurysms.centroids = ma_centroids;
    results.microaneurysms.mask = ma_mask;
    
    %% 5. Exudate Segmentation
    hsv_img = rgb2hsv(img);
    H = hsv_img(:,:,1) * 360;
    S = hsv_img(:,:,2);
    V = hsv_img(:,:,3);
    
    ex_yellow = (H >= 15 & H <= 45) & (S > 20/255) & (V > 180/255);
    ex_white = (S < 40/255) & (V > 200/255);
    ex_candidates = ex_yellow | ex_white;
    
    ex_cleaned = imopen(ex_candidates, strel('disk', 3));
    ex_cleaned = bwareaopen(ex_cleaned, 20); % Area >= 20
    
    % Remove optic disc area (exudates don't form on the OD)
    [Y, X] = ndgrid(1:h, 1:w);
    dist_to_od = sqrt((X - od_center(1)).^2 + (Y - od_center(2)).^2);
    ex_cleaned(dist_to_od < od_radius * 1.5) = false;
    
    results.exudates.mask = ex_cleaned;
    results.exudates.count = bwconncomp(ex_cleaned).NumObjects;
    
    % Macular exudates for DME flag (central 22% radial zone from fovea)
    macula_radius = 0.22 * w;
    dist_to_fovea = sqrt((X - fovea_x).^2 + (Y - fovea_y).^2);
    macular_exudates = ex_cleaned & (dist_to_fovea < macula_radius);
    
    results.exudates.dme_flag = any(macular_exudates(:));
    
    %% 6. Hemorrhage Detection with Sub-classification
    R = img(:,:,1);
    G = img(:,:,2);
    
    hem_candidates = (R > 60) & (R < 160) & (R > G*1.5) & (G < 80);
    hem_cleaned = imopen(hem_candidates, strel('disk', 4));
    
    hem_props = regionprops(hem_cleaned, 'Area', 'Eccentricity', 'PixelIdxList');
    
    dot_count = 0;
    blot_count = 0;
    flame_count = 0;
    
    for i = 1:length(hem_props)
        area = hem_props(i).Area;
        ecc = hem_props(i).Eccentricity;
        
        if area < 100 && ecc < 0.5
            dot_count = dot_count + 1;
        elseif area >= 100 && area <= 2000 && ecc < 0.7
            blot_count = blot_count + 1;
        elseif area > 100 && ecc >= 0.7
            flame_count = flame_count + 1;
        end
    end
    
    results.hemorrhages.mask = hem_cleaned;
    results.hemorrhages.area_fraction = sum(hem_cleaned(:)) / (h*w);
    results.hemorrhages.dot_count = dot_count;
    results.hemorrhages.blot_count = blot_count;
    results.hemorrhages.flame_count = flame_count;
    
    %% 7. Neovascularization Detection
    % Density near OD
    od_region = dist_to_od <= (2 * od_radius);
    non_od_region = dist_to_od > (2 * od_radius);
    
    od_density = sum(vessel_mask(od_region)) / max(1, sum(od_region(:)));
    rest_density = sum(vessel_mask(non_od_region)) / max(1, sum(non_od_region(:)));
    
    results.neovascularization.flag = od_density > (2 * rest_density);
    results.neovascularization.confidence = min(1.0, od_density / (2 * rest_density));
    
    %% 8. Visualization
    figure('Name', 'Retinal Segmentation', 'Position', [100 100 800 600]);
    imshow(img); hold on;
    
    % Vessel mask (Green overlay)
    visboundaries(vessel_mask, 'Color', 'g', 'LineWidth', 0.5);
    
    % MA dots (Yellow dots)
    if ~isempty(ma_centroids)
        plot(ma_centroids(:,1), ma_centroids(:,2), 'y.', 'MarkerSize', 10);
    end
    
    % Exudates (Cyan overlay)
    visboundaries(ex_cleaned, 'Color', 'c', 'LineWidth', 1);
    
    % Hemorrhages (Red overlay)
    visboundaries(hem_cleaned, 'Color', 'r', 'LineWidth', 1);
    
    % OD Circle
    viscircles(od_center, od_radius, 'Color', 'b', 'LineStyle', '--');
    
    % Fovea Marker
    plot(fovea_x, fovea_y, 'w+', 'MarkerSize', 15, 'LineWidth', 2);
    
    % NV Region (if flagged)
    if results.neovascularization.flag
        viscircles(od_center, 2*od_radius, 'Color', 'm', 'LineStyle', '-.');
        text(od_center(1), od_center(2)-2*od_radius-20, 'NV Suspected', 'Color', 'm', 'FontSize', 12, 'FontWeight', 'bold');
    end
    
    title('Comprehensive Retinal Segmentation');
    hold off;
    
end
