ALTER TABLE `appointment_requests` ADD `preferredTime` varchar(16) NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` ADD `assignedTime` varchar(16) NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` ADD `queueNumber` int NULL;--> statement-breakpoint
UPDATE `appointment_requests` AS target
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `preferredDate` ORDER BY `createdAt`, `id`) AS `dailyPosition`
  FROM `appointment_requests`
) AS ranked ON ranked.`id` = target.`id`
SET target.`preferredTime` = '09:00 AM', target.`assignedTime` = CONCAT(LPAD(MOD(9 + FLOOR((ranked.`dailyPosition` - 1) * 0.5), 12), 2, '0'), ':', IF(MOD(ranked.`dailyPosition` - 1, 2) = 0, '00', '30'), ' AM'), target.`queueNumber` = ranked.`dailyPosition`;--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY `preferredTime` varchar(16) DEFAULT '09:00 AM' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY `assignedTime` varchar(16) DEFAULT '09:00 AM' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY `queueNumber` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` ADD CONSTRAINT `appointment_requests_date_queue_unique` UNIQUE(`preferredDate`,`queueNumber`);--> statement-breakpoint
ALTER TABLE `appointment_requests` ADD CONSTRAINT `appointment_requests_date_time_unique` UNIQUE(`preferredDate`,`assignedTime`);
