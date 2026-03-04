package com.optiwms.coreapp.reports;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ScheduledReportsRunner {

    private final ReportsService reportsService;

    public ScheduledReportsRunner(ReportsService reportsService) {
        this.reportsService = reportsService;
    }

    @Scheduled(cron = "0 * * * * ?")
    public void runDueReports() {
        reportsService.runDueScheduledReports();
    }
}
