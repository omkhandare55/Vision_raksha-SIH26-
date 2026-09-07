function [metrics] = compute_metrics(predictions, ground_truth)
%COMPUTE_METRICS Compute clinical validation metrics for DR grading.
%
% [metrics] = compute_metrics(predictions, ground_truth)
%
% Inputs:
%   predictions  - Nx1 numeric array of predicted grades (0-4)
%   ground_truth - Nx1 numeric array of ground truth grades (0-4)
%
% Outputs:
%   metrics      - Struct containing various computed metrics
%                  (Kappa, Sensitivity, Specificity, AUC, etc.)

    % Validate inputs
    if length(predictions) ~= length(ground_truth)
        error('Predictions and ground truth must be of the same length.');
    end
    
    predictions = predictions(:);
    ground_truth = ground_truth(:);
    N = length(ground_truth);
    
    % 1. Per-class Confusion Matrix
    conf_mat = confusionmat(ground_truth, predictions, 'Order', [0, 1, 2, 3, 4]);
    metrics.ConfusionMatrix = conf_mat;
    
    % 2. Quadratic Weighted Kappa
    % Create weights matrix
    num_classes = 5;
    W = zeros(num_classes, num_classes);
    for i = 1:num_classes
        for j = 1:num_classes
            W(i, j) = ((i - j)^2) / ((num_classes - 1)^2);
        end
    end
    
    % Expected matrix
    hist_gt = histcounts(ground_truth, -0.5:4.5);
    hist_pr = histcounts(predictions, -0.5:4.5);
    E = (hist_gt' * hist_pr) / N;
    
    % Normalize matrices
    O_norm = conf_mat / sum(conf_mat(:));
    E_norm = E / sum(E(:));
    
    % Calculate Kappa
    kappa = 1 - (sum(sum(W .* O_norm)) / sum(sum(W .* E_norm)));
    metrics.QuadraticWeightedKappa = kappa;
    
    % 3. Binary Referable DR metrics (Level 2+ vs Level 0-1)
    bin_gt = ground_truth >= 2;
    bin_pr = predictions >= 2;
    
    TP = sum(bin_gt == 1 & bin_pr == 1);
    TN = sum(bin_gt == 0 & bin_pr == 0);
    FP = sum(bin_gt == 0 & bin_pr == 1);
    FN = sum(bin_gt == 1 & bin_pr == 0);
    
    sensitivity = TP / (TP + FN);
    specificity = TN / (TN + FP);
    ppv = TP / (TP + FP);
    npv = TN / (TN + FN);
    
    metrics.ReferableDR.Sensitivity = sensitivity;
    metrics.ReferableDR.Specificity = specificity;
    metrics.ReferableDR.PPV = ppv;
    metrics.ReferableDR.NPV = npv;
    
    % AUC-ROC curve for referable DR
    % Note: Using continuous predictions would yield a better ROC, but here we 
    % approximate using the binary thresholds or raw grade if available.
    [X_roc, Y_roc, T_roc, AUC] = perfcurve(bin_gt, predictions, 1);
    metrics.ReferableDR.AUC = AUC;
    
    % 4. Per-class precision, recall, F1-score
    precision = zeros(num_classes, 1);
    recall = zeros(num_classes, 1);
    f1_score = zeros(num_classes, 1);
    
    for i = 1:num_classes
        tp_c = conf_mat(i, i);
        fp_c = sum(conf_mat(:, i)) - tp_c;
        fn_c = sum(conf_mat(i, :)) - tp_c;
        
        precision(i) = tp_c / (tp_c + fp_c + eps);
        recall(i) = tp_c / (tp_c + fn_c + eps);
        f1_score(i) = 2 * (precision(i) * recall(i)) / (precision(i) + recall(i) + eps);
    end
    
    metrics.PerClass.Precision = precision;
    metrics.PerClass.Recall = recall;
    metrics.PerClass.F1Score = f1_score;
    
    % --- Display Formatted Results Table ---
    fprintf('=== Clinical Validation Metrics ===\n');
    fprintf('Quadratic Weighted Kappa: %.4f\n\n', kappa);
    fprintf('--- Referable DR (Grade >= 2) ---\n');
    fprintf('Sensitivity (TPR): %.2f%%\n', sensitivity * 100);
    fprintf('Specificity (TNR): %.2f%%\n', specificity * 100);
    fprintf('PPV (Precision):   %.2f%%\n', ppv * 100);
    fprintf('NPV:               %.2f%%\n', npv * 100);
    fprintf('AUC-ROC:           %.4f\n\n', AUC);
    
    fprintf('--- Per-Class Metrics ---\n');
    fprintf('Grade\tPrecision\tRecall\t\tF1-Score\n');
    for i = 1:num_classes
        fprintf('%d\t\t%.4f\t\t%.4f\t\t%.4f\n', i-1, precision(i), recall(i), f1_score(i));
    end
    fprintf('\n');
    
    % --- Benchmark Comparison Table ---
    fprintf('--- Benchmark Comparison (Referable DR) ---\n');
    fprintf('Method\t\t\tSensitivity\tSpecificity\n');
    fprintf('Gulshan et al. (2016)\t97.5%%\t\t93.4%%\n');
    fprintf('Ting et al. (2017)\t90.5%%\t\t91.6%%\n');
    fprintf('IDRiD Challenge (Avg)\t~95.0%%\t\t~92.0%%\n');
    fprintf('Our Pipeline\t\t%.1f%%\t\t%.1f%%\n', sensitivity*100, specificity*100);
    
    % --- Generate Figures ---
    figure('Name', 'DR Screening Clinical Validation', 'Position', [100 100 1200 400]);
    
    % 1. Confusion Matrix
    subplot(1, 3, 1);
    cm = confusionchart(ground_truth, predictions, 'RowSummary','row-normalized','ColumnSummary','column-normalized');
    cm.Title = 'DR Grade Confusion Matrix';
    
    % 2. ROC Curve
    subplot(1, 3, 2);
    plot(X_roc, Y_roc, 'b-', 'LineWidth', 2);
    hold on;
    plot([0 1], [0 1], 'k--');
    xlabel('False Positive Rate (1 - Specificity)');
    ylabel('True Positive Rate (Sensitivity)');
    title(sprintf('Referable DR ROC (AUC = %.3f)', AUC));
    grid on;
    
    % 3. Per-class Precision/Recall Bar Chart
    subplot(1, 3, 3);
    bar(0:4, [precision, recall]);
    xlabel('DR Grade');
    ylabel('Score');
    title('Per-Class Precision and Recall');
    legend('Precision', 'Recall', 'Location', 'southoutside', 'Orientation', 'horizontal');
    ylim([0 1.1]);
    grid on;
end
