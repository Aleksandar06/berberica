import { Global, Module } from "@nestjs/common";

import { EmailSenderService } from "./email-sender.service";
import { NotificationDispatcherService } from "./notification-dispatcher.service";

/**
 * Notification channel. Marked @Global so any feature module that writes
 * to `notification_events` (verification, bookings, ...) can inject
 * `NotificationDispatcherService` without re-importing.
 *
 * Today only email (Resend). The dispatcher is the seam for adding SMS,
 * push, or a different provider.
 */
@Global()
@Module({
  providers: [EmailSenderService, NotificationDispatcherService],
  exports: [EmailSenderService, NotificationDispatcherService],
})
export class NotificationsModule {}
