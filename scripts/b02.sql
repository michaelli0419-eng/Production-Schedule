INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11573','Palm Springs Two Bunch Palms 
(1) 8''-6" x 16''-7" RR','Palm Springs USD','handoff',95,112000,106400,'2026-08-01','Diana',NULL,'Jack / Kenny','8’-6”x16’-7” RR',0,'PO should be received by 6/9/26
---
Project is moving forward, district working on a timeline. Back check appointment 4/8.','excel_import','Master Jobs',23),
('crm-11582','Wasco UHSD Wasco HS
(5) 30x32 Classrooms & (1) 30x32 RR','Wasco Union HSD','handoff',95,2970266.23,2821753,'2027-05-03','Joe',NULL,'Joe/Daniel','(5) 30X32 Classrooms 
(1) 30X32 Restroom',0,'Contract received; project paused
until March 2027
---
Per District, project on pause until March 2027','excel_import','Master Jobs',24),
('crm-11594','Ventura USD 
ATLAS School
(1) 12x60 RR','Ventura USD','handoff',95,382738.04,363601,'2026-07-01','Diana',NULL,'Uzi/Rod','(1) 12x60 Restroom',0,'PO
---
DSA Approved. Per District, this project will be for Summer 2026.
---
Needs ceramic tile and Partitions','excel_import','Master Jobs',25),
('crm-11596','Oceanside Jefferson A3','Oceanside USD','handoff',95,5197374,4937505,'2026-04-01','Diana',NULL,'Uzi/Rod','(1) 84''x40'' Kitchen 
(2) 96''x40'' CR Bldgs. 
(1) 60''x40'' Music Bldg. 
(2) 24''x40'' RR Bldgs.',0,'Yes - 
Need Roofing Change Order
---
Pending confirmation of options taken to finalize project pricing and scope.
---
Just needs partitions , Delivered (5/20)','excel_import','Master Jobs',26),
('crm-row-27','Oceanside Jefferson B3','Oceanside USD','handoff',95,5197374,4937505,'2026-04-01','Diana',NULL,'Uzi/Rod','(1) 84''x40'' Kitchen 
(2) 96''x40'' CR Bldgs. 
(1) 60''x40'' Music Bldg. 
(2) 24''x40'' RR Bldgs.',0,'Yes - 
Need Roofing Change Order
---
Pending confirmation of options taken to finalize project pricing and scope.
---
Just needs partitions , Delivered (5/20)','excel_import','Master Jobs',27),
('crm-row-28','Oceanside Jefferson MS (9 floors)
#1 (BLD-A2) 108x40','Oceanside USD','handoff',95,5197374,4937505,'2026-04-01','Diana',NULL,'Uzi/Kenny/Rod','(1) 84''x40'' Kitchen 
(2) 96''x40'' CR Bldgs. 
(1) 60''x40'' Music Bldg. 
(2) 24''x40'' RR Bldgs.',0,'Yes
---
Pending confirmation of options taken to finalize project pricing and scope.
---
Building A2 was moved off the line with shortages:                                                                                                                                                                                                                                                                                                                                                                      ...','excel_import','Master Jobs',28),
('crm-row-29','Oceanside Jefferson MS (7 floors)
#2 (BLD-A3) 60x40 & 24x40 RR','Oceanside USD','handoff',95,5197374,4937505,'2026-04-01','Diana',NULL,'Uzi/Kenny/Rod','(1) 84''x40'' Kitchen 
(2) 96''x40'' CR Bldgs. 
(1) 60''x40'' Music Bldg. 
(2) 24''x40'' RR Bldgs.',0,'Yes
---
Pending confirmation of options taken to finalize project pricing and scope.
---
Building A3 was moved off the line with shortages:                                                                                                                                                                                                                                                                                                                                                                      ...','excel_import','Master Jobs',29),
('crm-row-30','Oceanside Jefferson MS (8 floors) 
#3 (BLD-A1) 96x40','Oceanside USD','handoff',95,5197374,4937505,'2026-04-01','Diana',NULL,'Uzi/Kenny/Rod','(1) 84''x40'' Kitchen 
(2) 96''x40'' CR Bldgs. 
(1) 60''x40'' Music Bldg. 
(2) 24''x40'' RR Bldgs.',0,'Yes
---
Pending confirmation of options taken to finalize project pricing and scope.
---
Building A1 was moved off the line with shortages:                                                                                                                                                                                                                                                                                                                                                                      ...','excel_import','Master Jobs',30),
('crm-row-31','Oceanside Jefferson MS (9 floors) 
#4 (BLD-B3) 84x40 & 24x40 RR','Oceanside USD','handoff',95,5197374,4937505,'2026-04-01','Diana',NULL,'Uzi/Kenny/Rod','(1) 84''x40'' Kitchen 
(2) 96''x40'' CR Bldgs. 
(1) 60''x40'' Music Bldg. 
(2) 24''x40'' RR Bldgs.',0,'Yes
---
Pending confirmation of options taken to finalize project pricing and scope.
---
Building B3 was moved off the line with shortages:                                                                                                                                                                                                                                                                                                                                                                      ...','excel_import','Master Jobs',31),
('crm-11618','San Jacinto HS 170/120x32 (58 floors)','San Jacinto USD','handoff',95,13511007.16,12835457,'2026-11-01','Diana',NULL,'Gino/Ramon','Two Story 170''/120'' x 32''',0,'Contract
---
Contract is for 650 days from NTP. Project bids on 2/27/25. District is still reviewing paperwork for accuracy. Will send notification of SCM being the successful bidder after. As of 4/1 the district confirmed that they are still working with their legal team to put together the agreement before issuing us the NTP.
---
1. Ladder, ETA 6/24/26 will need to be installed on-site.                                                                                                          ...','excel_import','Master Jobs',32)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;