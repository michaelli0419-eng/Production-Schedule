INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11677','Anaheim Cypress (1) 12x40 RR','Anaheim Union HSD','award',80,341490,273192,'2026-09-02','Sandra',NULL,'Mark / Gino','(1) 12x40 RR',0,'Lease-leaseback in process as of 5/26/26 - July timeframe
---
Submitted to DSA will be awarded through a lease lease back contract','excel_import','Master Jobs',83),
('crm-11678','Rosemead Janson (1) 24x40','Rosemead USD','handoff',95,280662.6,266629,'2026-09-14','Diana',NULL,'Gino/Kevin','(1) 24''x40'' classroom with two restrooms',0,'Signed Agreement Received 4/6/26
---
Scope finalized on 3/6, repricing received. Next step is drawings','excel_import','Master Jobs',84),
('crm-11679','MAOF Beta Vista Headstart (1) 60x40 - 5 Floors','MAOF/LAUSD Headstart','handoff',95,743643.93,706462,'2026-07-01','Sandra',NULL,'Uzi/Brett','(1) 40x60 Headstart Bldgs',0,'Piggyback breadown in process - 
Sandra doing revisions as of 5/26/26
---
Received Signed Proposal to begin Drawings - PO to be issued in May','excel_import','Master Jobs',85),
('crm-11680','MAOF City of Terrace Headstart (1) 52x40 - 4 Floors','MAOF/LAUSD Headstart','handoff',95,727753.87,691366,'2026-07-08','Sandra',NULL,'Uzi/Brett','(1) 40x52 Building',0,'Piggyback breadown in process - 
Sandra doing revisions as of 5/26/26
---
Received Signed Proposal to begin Drawings - PO to be issued in May','excel_import','Master Jobs',86),
('crm-11681','Mobile Modular Melrose (1) 12x40 RR','Mobile Modular','lead',15,139000,20850,'2026-06-08','Diana',NULL,'Mark, Need PM','(1) 12x40 B2 RR',0,'PO Received 4/7/26','excel_import','Master Jobs',87),
('crm-11682','Mobile Modular Charles White Park (1) 64 x 79','Mobile Modular','proposal',55,1477409.23,812575,'2027-03-26','Diana',NULL,'Mike','(1) 64''x 79'' Community Building HCD approval',0,'PO received for the design of the project','excel_import','Master Jobs',88),
('crm-11683','Redlands Cope MS (1) 12x40 RR','Redlands USD','handoff',95,203200.93,193041,'2027-08-01','Diana',NULL,'James','(1) 12''x40'' Restroom Bldg',0,'Drawings in process','excel_import','Master Jobs',89),
('crm-11684','Oxnard Fremont (2) 36x40','Oxnard SD','lead',15,0,0,'2027-01-01','Sandra',NULL,NULL,'(2) 36x40 Buildings',0,'Will be piggyback - contract 
likely by August
---
Update as of 5/6/26 - production start in Jan 2027; full bin submittal','excel_import','Master Jobs',90),
('crm-11685','Orange Panorama (2) 24x40','Orange USD','handoff',95,362689.71,344555,'2026-07-01','Sandra',NULL,'Mark','(2) 24x40 Buildings',0,'Piggyback breakdown in process
 as of 5/26/26 - Sandra
---
District working on purchase order','excel_import','Master Jobs',91),
('crm-11686','Folsom Cordova
 (1) 156''x 40 & (1) 144''x 40''','Folsom Cordova USD','handoff',95,7087082,6732728,'2027-07-01','Frank',NULL,NULL,'(1) 156''x 40 & (1) 144''x 40''',0,'5/14 Kickoff meeting scheduled to release to engineering','excel_import','Master Jobs',92)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;