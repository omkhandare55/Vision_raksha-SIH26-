% RUN_SIMULATION Scenarios script for DR Screening Pipeline
%
% This script runs multiple configurations of the telemedicine pipeline
% and evaluates scalability, throughput, and wait times.

function results = run_simulation()
    disp('--- Running DR Screening Pipeline Simulation ---');
    
    % Scenario 1: Baseline
    disp('Scenario 1: Baseline (10 PHCs, 3G, 2 Doctors, GPU)');
    p1 = get_default_params();
    p1.num_phc = 10;
    p1.bandwidth_mbps = 200 / 1024; % 3G
    p1.num_doctors = 2;
    p1.ai_service_time = 1.2; % GPU
    res1 = build_screening_model(p1);
    
    % Scenario 2: Rural Worst Case
    disp('Scenario 2: Rural Worst Case (15 PHCs, 2G, 1 Doctor, CPU)');
    p2 = get_default_params();
    p2.num_phc = 15;
    p2.bandwidth_mbps = 30 / 1024; % 2G
    p2.num_doctors = 1;
    p2.ai_service_time = 8.0; % CPU
    res2 = build_screening_model(p2);
    
    % Scenario 3: Optimized
    disp('Scenario 3: Optimized (10 PHCs, 4G, 3 Doctors, GPU)');
    p3 = get_default_params();
    p3.num_phc = 10;
    p3.bandwidth_mbps = 1.0; % 4G
    p3.num_doctors = 3;
    p3.ai_service_time = 1.2;
    res3 = build_screening_model(p3);
    
    % Scenario 4: Scaling (50 PHCs)
    disp('Scenario 4: Scaling (50 PHCs, 4G, 10 Doctors, GPU)');
    p4 = get_default_params();
    p4.num_phc = 50;
    p4.bandwidth_mbps = 1.0;
    p4.num_doctors = 10;
    p4.ai_service_time = 1.2;
    res4 = build_screening_model(p4);
    
    results = {res1, res2, res3, res4};
    
    disp('--- Simulation Complete ---');
end

function p = get_default_params()
    p.num_phc = 10;
    p.lambda_patients_per_day = 40;
    p.capture_stations_per_phc = 1;
    p.quality_pass_rate = 0.82;
    p.max_retries = 2;
    p.bandwidth_mbps = 0.2;
    p.image_size_mb = 4;
    p.ai_service_time = 1.2;
    p.num_doctors = 2;
    p.doctor_service_time = 30;
    p.days_to_simulate = 250; % 1 working year
end
