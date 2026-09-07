% PLOT_RESULTS Visualizes the metrics from the simulation scenarios.
% Generates publication-quality figures for the SIH presentation.

function plot_results(results)
    if nargin < 1
        % Run the simulation if results are not provided
        results = run_simulation();
    end
    
    scenarios = {'Baseline', 'Rural Worst Case', 'Optimized', 'Scaling'};
    wait_times = cellfun(@(x) x.avg_wait_time_mins, results);
    throughputs = cellfun(@(x) x.total_screened, results);
    
    % Figure 1: Wait Times
    figure('Name', 'Wait Times by Scenario', 'Position', [100, 100, 800, 400]);
    bar(wait_times);
    set(gca, 'XTickLabel', scenarios);
    ylabel('Average Wait Time (Minutes)');
    title('Average Patient Wait Time per Scenario');
    grid on;
    saveas(gcf, 'wait_times.png');
    
    % Figure 2: Resource Utilization Heatmap
    figure('Name', 'Resource Utilization', 'Position', [100, 100, 800, 500]);
    util_matrix = zeros(4, 4);
    for i = 1:4
        util_matrix(i, :) = results{i}.utilizations;
    end
    heatmap({'Capture', 'Upload', 'AI', 'Doctor'}, scenarios, util_matrix, ...
        'Title', 'Resource Utilization Heatmap', 'Colormap', jet, ...
        'ColorLimits', [0 1]);
    saveas(gcf, 'utilization_heatmap.png');
    
    % Figure 3: Total Annual Capacity
    figure('Name', 'Annual Capacity', 'Position', [100, 100, 800, 400]);
    bar(throughputs);
    set(gca, 'XTickLabel', scenarios);
    ylabel('Total Patients Screened (Annually)');
    title('Annual Throughput per Scenario');
    grid on;
    saveas(gcf, 'annual_throughput.png');
    
    disp('Plots generated and saved as PNG.');
end
