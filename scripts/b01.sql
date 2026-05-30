INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-row-13','Oceanside Surfside (9 Floors) 108 x 40 Building A Admin','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Flashing design was approved. Cardinal sheet metal is pricing out the 8'' and 5'' pan flashing. Production is doing a takeoff on the quantities needed per building and have purchasing issue a PO to cardinal to start manufacturing. Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and...','excel_import','Master Jobs',13),
('crm-row-14','Oceanside Surfside (3 Floors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          36  x 40 Building C Daycare','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Flashing design was approved. Cardinal sheet metal is pricing out the 8'' and 5'' pan flashing. Production is doing a takeoff on the quantities needed per building and have purchasing issue a PO to cardinal to start manufacturing. Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and...','excel_import','Master Jobs',14),
('crm-row-15','Oceanside Surfside (5 FLoors) (1) 60 x 40 FItness Building and Restroom.        Building G','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Flashing design was approved. Cardinal sheet metal is pricing out the 8'' and 5'' pan flashing. Production is doing a takeoff on the quantities needed per building and have purchasing issue a PO to cardinal to start manufacturing. Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and...','excel_import','Master Jobs',15),
('crm-row-16','Oceanside Surfside (9 FLoors) (3) 24 x 40 CR and (1) 1240 RR  Building Building D1.','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and there is alot of prepping to do in order to repaint these frames since they have been installed. We are still waiting on answer on parapet color. Subcontractor work has not started yet on storefronts, ceramic tile, and casework....','excel_import','Master Jobs',16),
('crm-row-17','Oceanside Surfside (9 Floors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          (4) 24  x 40 & (1) 12 x 40 restroom Building J1','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Flashing design was approved. Cardinal sheet metal is pricing out the 8'' and 5'' pan flashing. Production is doing a takeoff on the quantities needed per building and have purchasing issue a PO to cardinal to start manufacturing. Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and...','excel_import','Master Jobs',17),
('crm-row-18','Oceanside Surfside (7 Floors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          (3) 24  x 40 & (1) 12 x 40 restroom Building J2','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Flashing design was approved. Cardinal sheet metal is pricing out the 8'' and 5'' pan flashing. Production is doing a takeoff on the quantities needed per building and have purchasing issue a PO to cardinal to start manufacturing. Other items that are still pending waiting for answers or directions: New door frame color, customer is changing color and we have yet to receive the new color. the cost to repaint 19 frames will be a change order and...','excel_import','Master Jobs',18),
('crm-row-19','Oceanside Surfside (8 floors) (2) 36 x 40 CR and (1) 24 x 40 CR Building K','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
We have 3 more floors of Building K to run  thorught he line and this will be parked in the yard. these are units that will be comleted this wee.','excel_import','Master Jobs',19),
('crm-row-20','Oceanside Surfside (10 Floors) 120 x 40 Building H','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Kenny/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Casework will be completed this week. Assured glass in currently installing window and door frames and installing glazing. Metcalf is installing first layer of mud, need to schedule roofing subcontractor to install  garland 60mil PVC roof. We are still missing finish colors or possible changes to the projects. This building will be pulled off 1/30/26. We are still missing info on interior door paint colors. We will be installing door in the y...','excel_import','Master Jobs',20),
('crm-row-21','Oceanside Surfside D1','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Uzi/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Completed','excel_import','Master Jobs',21),
('crm-row-22','Oceanside Surfside H','Oceanside USD','handoff',95,2884146.43,2739939,'2025-12-01','Sandra',NULL,'Uzi/Rod','(1) 84x60 Student Center',0,'Yes
---
Will be built with the other buildings
---
Completed','excel_import','Master Jobs',22)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;