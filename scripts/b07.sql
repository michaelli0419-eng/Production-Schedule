INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11667','Anaheim Katella (1) 12x40 RR','Anaheim Union HSD','award',80,288840,231072,'2026-07-28','Sandra',NULL,'Moanes/Mark','(1) 12x40 TB C1',0,'Lease-leaseback in process as of 5/26/26 - July timeframe
---
Will be bid through lease lease back and recommentd SCM @ manufactuer Received Comments and corrections Mark addressed','excel_import','Master Jobs',73),
('crm-11668','Anaheim Kennedy (1) 12x40 RR','Anaheim Union HSD','award',80,307679.28,246143,'2026-07-29','Sandra',NULL,'Moanes/Mark','(1) 12x40 TB Multi User',0,'Lease-leaseback in process as of 5/26/26 - July timeframe
---
Will be bid through lease lease back and recommentd SCM @ manufactuer','excel_import','Master Jobs',74),
('crm-11669','Rosemead Encinita (1) 24x40','Rosemead USD','handoff',95,187350.66,177983,'2026-06-18','Diana',NULL,'Moanes/James','(1) 24''x40'' Open Classroom',0,'Signed Agreement Received 4/6/26
---
Final proposal was sent to the AOR. Hand-off meeting to engineering took place. Waiting on confirmation on a few items from AOR for engineering to start drawings.','excel_import','Master Jobs',75),
('crm-11670','Mobile Modular 
(1) 48x40 & (1) 12x40 RR','Mobile Modular','lead',15,395260.99,59289,'2026-07-15',NULL,NULL,'Joseph/Jack','(1) 48'' X 40'' CR AND (1) 12'' X 40'' RR BUILDING',0,'PO to be received by 4/3/26

Adela calling customer on status 5/26/26
---
PO depending on GC - likely to be received in June 2026
---
1. We cannot build this job until we have a signed contract, Lab of record, or an in-plant inspector','excel_import','Master Jobs',76),
('crm-11671','ABC USD Leal ES (2) 24x40','ABC USD','handoff',95,305786,290497,'2026-05-14','Sandra',NULL,'Moanes/Mark','(2) 24x40 Classroom Bldgs',0,'PO
---
DSA approved they are working on finalizing submittals
---
Will be ready by 6/3/26','excel_import','Master Jobs',77),
('crm-11672','Oaks Christian (12) 24x40 & (2) 12x40 RR','Oaks Christian School','proposal',55,1999000,1099450,'2026-04-09','Sandra',NULL,'Moanes/Mark','(12) 24x40 and (2) 12x40 RR',0,'Contract received 3/26/26
---
DSA App 3/25/26
---
1. Need answer on Restroom ramps. 
2. Missing partitions                                                                                                                                                                                                                                                                                                                                                                                                       ...','excel_import','Master Jobs',78),
('crm-11673','Bassett USD Don Julian (1) 96x40 - 16 Floors','Bassett USD','handoff',95,3730911.74,3544366,'2026-12-30','Sandra',NULL,'Daniel / Kenny','(1) 96’ x 40’ Two Story Bldg',0,'Executed Contract Dated 3/9/26 / NTP Dated 4/01/26
---
Received contract.','excel_import','Master Jobs',79),
('crm-11674','Rescue Union SD 
Rescue ES 
(1) 8.5x32 RR','Rescue USD','handoff',95,169778.33,161289,'2026-08-05','Frank',NULL,'Brandon/Mark','(1) 8.5x32 Restroom',0,'PB breakdown to sent to District week of 5/18 - PO to follow
---
Drawings went to DSA for approval on 5/13','excel_import','Master Jobs',80),
('crm-11675','Anaheim Loara (1) 12x40 RR','Anaheim Union HSD','award',80,0,0,'2026-09-01','Sandra',NULL,'Mark / Gino','(1) 12x40 RR',0,'Lease-leaseback in process as of 5/26/26 - July timeframe
---
Submitted to DSA will be awarded through a lease lease back contract','excel_import','Master Jobs',81),
('crm-11676','Anaheim Savannah (1) 12x60 RR','Anaheim Union HSD','lead',15,0,0,'2026-10-12','Sandra',NULL,'Mark / Gino','(1) 12x60 RR',0,'Lease-leaseback in process as of 5/26/26 - July timeframe
---
Submitted to DSA will be awarded through a lease lease back contract','excel_import','Master Jobs',82)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;