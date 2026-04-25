import { Injectable, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsSchedulerService implements OnModuleInit {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private readonly notificationsService: NotificationsService) {}

  onModuleInit() {
    this.startScheduler();
  }

  private startScheduler() {
    // Run notification checks every 6 hours
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    
    // Run immediately on startup
    this.notificationsService.runAllChecks().catch(err => {
      console.error('Failed to run initial notification checks:', err);
    });

    // Then schedule for every 6 hours
    this.intervalId = setInterval(() => {
      this.notificationsService.runAllChecks().catch(err => {
        console.error('Failed to run scheduled notification checks:', err);
      });
    }, sixHoursInMs);

    console.log('Notifications scheduler started (every 6 hours)');
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('Notifications scheduler stopped');
    }
  }
}
