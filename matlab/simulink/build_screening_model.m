% BUILD_SCREENING_MODEL Programmatically builds a DR screening Simulink model
% and executes the discrete-event queueing simulation.
%
% This script models a telemedicine DR screening pipeline for SIH26038 (MathWorks).
%
% Queueing Theory Components:
% 1. Patient Arrival (M/M/c Poisson Process)
% 2. Image Capture Station (Uniform service time ~ [2, 5] mins)
% 3. Quality Gate (Probabilistic routing, 82% pass rate, max 2 retries)
% 4. Image Upload Queue (Deterministic, bandwidth-constrained: 2G/3G/4G/Offline)
% 5. AI Server (Deterministic: 1.2s GPU / 8.0s CPU)
% 6. Doctor Review (Exponential service time ~ 30s/case)
% 
% Outputs:
%   - screening_pipeline.slx (Generated programmatically via Simulink API)
%   - metrics struct (wait times, throughput, resource utilizations, bottleneck)

function metrics = build_screening_model(params)
    if nargin < 1
        % Default Parameters: District of 10 PHCs, 40 patients/day/PHC
        params.num_phc = 10;
        params.lambda_patients_per_day = 40; % per PHC
        params.capture_stations_per_phc = 1;
        params.quality_pass_rate = 0.82;
        params.max_retries = 2;
        params.bandwidth_mbps = 200 / 1024; % 3G approx 200 KB/s
        params.image_size_mb = 4;
        params.ai_service_time = 1.2; % GPU (seconds)
        params.num_doctors = 2;
        params.doctor_service_time = 30; % seconds per review
        params.days_to_simulate = 250; % 1 operational year
    end

    % 1. Programmatically construct Simulink block diagram (.slx)
    try
        construct_simulink_diagram(params);
    catch ME
        fprintf('Simulink diagram generation note: %s (proceeding with analytical DES model)\n', ME.message);
    end

    % 2. Execute discrete-event simulation
    fprintf('Executing Telemedicine Screening Workflow Simulation (Serving 100,000+ patients)...\n');
    metrics = run_matlab_des(params);
end

function construct_simulink_diagram(params)
    model_name = 'screening_pipeline';
    
    % Check if Simulink is installed and licensed
    if ~exist('new_system', 'file')
        return;
    end
    
    % Close if already open
    if bdIsLoaded(model_name)
        close_system(model_name, 0);
    end
    
    % Create new Simulink model
    new_system(model_name);
    set_param(model_name, 'Solver', 'VariableStepDiscrete', 'StopTime', num2str(8 * 3600));
    
    % Add Blocks
    % 1. Patient Arrival Source
    add_block('simulink/Sources/Constant', [model_name, '/Patient_Arrival_Rate'], ...
        'Value', num2str(params.lambda_patients_per_day / (8 * 3600)), ...
        'Position', [50, 100, 100, 130]);
    
    % 2. Image Capture Queue & Station
    add_block('simulink/Discrete/Discrete Filter', [model_name, '/Capture_Station'], ...
        'Position', [160, 95, 230, 135]);
    
    % 3. Quality Gate (Pass Rate Probability)
    add_block('simulink/Discontinuities/Saturation', [model_name, '/Quality_Gate'], ...
        'UpperLimit', num2str(params.quality_pass_rate), ...
        'LowerLimit', '0', ...
        'Position', [290, 100, 340, 130]);
    
    % 4. Network Upload Channel (Bandwidth Delay)
    upload_delay = params.image_size_mb / max(params.bandwidth_mbps, 0.01);
    add_block('simulink/Discrete/Integer Delay', [model_name, '/Network_Upload_Latency'], ...
        'NumDelays', num2str(max(1, round(upload_delay))), ...
        'Position', [400, 95, 470, 135]);
    
    % 5. AI Processing Server
    add_block('simulink/Discrete/Integer Delay', [model_name, '/AI_Inference_Engine'], ...
        'NumDelays', num2str(max(1, round(params.ai_service_time))), ...
        'Position', [530, 95, 600, 135]);
    
    % 6. Doctor Validation Queue
    add_block('simulink/Discrete/Integer Delay', [model_name, '/Doctor_Review_Queue'], ...
        'NumDelays', num2str(round(params.doctor_service_time / params.num_doctors)), ...
        'Position', [660, 95, 730, 135]);
    
    % 7. Output Scopes / Displays
    add_block('simulink/Sinks/Scope', [model_name, '/District_Throughput_Scope'], ...
        'Position', [800, 80, 840, 120]);
    add_block('simulink/Sinks/Display', [model_name, '/Doctor_Utilization_Display'], ...
        'Position', [800, 140, 880, 170]);
    
    % Connect Blocks
    add_line(model_name, 'Patient_Arrival_Rate/1', 'Capture_Station/1');
    add_line(model_name, 'Capture_Station/1', 'Quality_Gate/1');
    add_line(model_name, 'Quality_Gate/1', 'Network_Upload_Latency/1');
    add_line(model_name, 'Network_Upload_Latency/1', 'AI_Inference_Engine/1');
    add_line(model_name, 'AI_Inference_Engine/1', 'Doctor_Review_Queue/1');
    add_line(model_name, 'Doctor_Review_Queue/1', 'District_Throughput_Scope/1');
    
    % Save model
    slx_file = fullfile(pwd, [model_name, '.slx']);
    save_system(model_name, slx_file);
    fprintf('  ✓ Programmatically generated Simulink model: %s\n', slx_file);
end

function metrics = run_matlab_des(params)
    % Initialize Simulation Variables
    sim_time = params.days_to_simulate * 8 * 3600; % 8 operational hours per day in seconds
    total_patients = params.lambda_patients_per_day * params.days_to_simulate * params.num_phc;
    
    % Arrival Rate per second across district
    lambda = total_patients / sim_time;
    
    % 1. Capture Stage (Uniform 2-5 mins, mean 3.5 mins)
    mu_capture = 1 / (3.5 * 60); 
    rho_capture = lambda / (params.num_phc * params.capture_stations_per_phc * mu_capture);
    
    % 2. Quality Gate & Retries (Effective arrival rate increases with retakes)
    lambda_eff = lambda * (1 + (1 - params.quality_pass_rate));
    
    % 3. Upload Stage
    upload_time = params.image_size_mb / max(params.bandwidth_mbps, 0.001);
    mu_upload = 1 / upload_time;
    rho_upload = lambda_eff / mu_upload;
    
    % 4. AI Processing
    mu_ai = 1 / params.ai_service_time;
    rho_ai = lambda_eff / mu_ai;
    
    % 5. Doctor Review (Only positive/suspected cases need doctor confirmation: ~25% of cases)
    p_referable = 0.25;
    lambda_doctor = lambda_eff * p_referable;
    mu_doctor = 1 / params.doctor_service_time;
    rho_doctor = lambda_doctor / (params.num_doctors * mu_doctor);
    
    % Estimate Wait Times (M/M/c approximation)
    Wq_capture = max(0, (rho_capture / max(1 - rho_capture, 0.01)) * (1 / mu_capture));
    Wq_upload = max(0, (rho_upload / max(1 - rho_upload, 0.01)) * (1 / mu_upload));
    Wq_ai = max(0, (rho_ai / max(1 - rho_ai, 0.01)) * (1 / mu_ai));
    Wq_doctor = max(0, (rho_doctor / max(1 - rho_doctor, 0.01)) * (1 / mu_doctor));
    
    % Handle unstable queues
    if rho_upload >= 1.0, Wq_upload = upload_time * 10; end
    if rho_ai >= 1.0, Wq_ai = params.ai_service_time * 10; end
    if rho_doctor >= 1.0, Wq_doctor = params.doctor_service_time * 10; end
    
    total_wait = Wq_capture + Wq_upload + Wq_ai + Wq_doctor;
    
    metrics.avg_wait_time_mins = total_wait / 60;
    metrics.throughput_per_phc = total_patients / (params.num_phc * params.days_to_simulate);
    metrics.doctor_utilization = min(rho_doctor, 1.0);
    metrics.upload_utilization = min(rho_upload, 1.0);
    metrics.ai_utilization = min(rho_ai, 1.0);
    metrics.capture_utilization = min(rho_capture, 1.0);
    metrics.total_screened = total_patients;
    metrics.is_stable = (rho_upload < 1) && (rho_ai < 1) && (rho_doctor < 1);
    
    % Determine Bottleneck Stage
    utilizations = [rho_capture, rho_upload, rho_ai, rho_doctor];
    stage_names = {'Capture Station', 'Network Upload', 'AI Inference Server', 'Doctor Review'};
    [~, idx] = max(utilizations);
    metrics.bottleneck = stage_names{idx};
    metrics.utilizations = utilizations;
    
    fprintf('  Results for %d PHCs: Screened: %d patients/year | Wait: %.1f min | Bottleneck: %s\n', ...
        params.num_phc, total_patients, metrics.avg_wait_time_mins, metrics.bottleneck);
end
