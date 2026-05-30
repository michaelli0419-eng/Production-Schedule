INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-7','Hesperia Krystal  (2) 24x40''s',NULL,'handoff',95,0,0,NULL,NULL,NULL,'Gino',NULL,0,'Yes
---
Building is offline and park in the yard. Building is still missing Exterior doors and interior doors for Riser Room that needs to be installed in the yard.  Production asked the question about the Floor drain in the riser room and has not received response if it is needed. there are no plumbing sheets showing the floor drain, no ptrap or trap primer for this floor drain. Socal FIre says he doesnt need it.','excel_import','Master Jobs',3),
('crm-11','Garvey Emerson (1) 24x40',NULL,'handoff',95,0,0,NULL,NULL,NULL,'Moanes/James',NULL,0,'Purchase Order
---
2025-06-04 00:00:00','excel_import','Master Jobs',4),
('crm-11589','Menifee Hans Christensen (1) 12x40 RR',NULL,'handoff',95,0,0,NULL,NULL,NULL,'Gino/James',NULL,0,'Yes - via CO
 on 11588
---
2025-07-17 00:00:00','excel_import','Master Jobs',5),
('crm-11620','Hesperia Juniper (1) 12x40 RR',NULL,'handoff',95,0,0,NULL,NULL,NULL,'Gino/Jack',NULL,0,'Yes
---
2025-08-25 00:00:00','excel_import','Master Jobs',6),
('crm-row-7','Hesperia Juniper (3) 24x40',NULL,'handoff',95,0,0,NULL,NULL,NULL,'Gino/Jack',NULL,0,'Yes
---
11/03 - 11/21','excel_import','Master Jobs',7),
('crm-11495','Mountain View Parkview 192x40 2-Story (32 floors)','Mountain View SD','award',80,6700000,5360000,'2026-12-31','Sandra',NULL,'Moanes /Rod','192X40 2-Story',0,'Project expected to bid mid 2026 -
meeting on 5/29/26 with District
---
Adela met with district and they are working on a piggyback to include  the two story architect noted it is a late fall project. Likely June bid
---
Revised Proposal sent to customer, project is now DSA 
approved. Per Adelas email this project appears to be a build for early 2027','excel_import','Master Jobs',8),
('crm-11562','Oceanside Surfside (1) 84x60 Student Center - Bldg B','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Rod / Uzi','(1) 84x60 Student Center',0,'Fully executed change order received 5/6/26
---
Will be built with the other buildings
---
1. Job Read rescheduled by U.S. for 5/28.                                                                                                                                                                                                                                                                                                                                                                             ...','excel_import','Master Jobs',9),
('crm-row-10','Oceanside Surfside J1','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Uzi/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Floor tile is back orderd, sub cannot get tile','excel_import','Master Jobs',10),
('crm-row-11','Oceanside Surfside G','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Uzi/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Floor tile is back orderd, sub cannot get tile','excel_import','Master Jobs',11),
('crm-row-12','Oceanside Surfside (9 FLoors) (3) 24 x 40 CR and (1) 36 x 40 CTE Building        Building D2.','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and there is alot of prepping to do in order to repaint these frames since they have been installed. We are still waiting on answer on parapet color. Subcontractor work has not started yet on storefronts, ceramic tile, and casework....','excel_import','Master Jobs',12)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;