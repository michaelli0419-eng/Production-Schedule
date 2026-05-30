INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11651','Lowell Meadow Green (1) 84x60','Lowell SD','handoff',95,1523311.2,1447146,'2027-03-18','Sandra',NULL,'Moanes/Daniel','84x60 Classrooms w/RR',0,'PO
---
In DSA','excel_import','Master Jobs',53),
('crm-11652','Lowell Macy (1) 84x60','Lowell SD','proposal',55,1513671,832519,'2026-07-28','Sandra',NULL,'Moanes/Daniel','84x60 Classrooms w/RR',0,'PO
---
In DSA
---
1. Job will go to fab shop at the last week of may for Prepping Truss and material for Concrete floors.                                                                                                                                                                                                                                                                                                                                                                                        ...','excel_import','Master Jobs',54),
('crm-11653','Lowell Olita (1) 108x60','Lowell SD','handoff',95,1853773,1761084,'2026-07-13','Sandra',NULL,'Moanes/Daniel','108x60 Classrooms w/RR',0,'PO
---
In DSA
---
1. Job will go to fab shop at the last week of may for Prepping Truss and material for Concrete floors.                                                                                                                                                                                                                                                                                                                                                                                        ...','excel_import','Master Jobs',55),
('crm-11654','Garvey Duff (1) 60x40','Garvey SD','handoff',95,803365.69,763197,'2026-05-14','Sandra',NULL,'Moanes/Mark','60’x40’ Childcare Building',0,'PO received 3/24/26
---
In production
---
1. Hollow metal Doors 5/28/26 - Wood Doors 5/19/26 - Partial Hardware 5/19 - back hardware 5/28/26 - Timely Frames 5/29                                                                                                                                                                                                                                                                                                                                                ...','excel_import','Master Jobs',56),
('crm-11655','Imperial County Little Bulldogs EHS (1) 48x60','Imperial County','handoff',95,754895,717150,'2026-02-24','Diana',NULL,'Uzi/Ramon','48''x60'' Daycare Kinder',0,'PO
---
Finalizing price and project schedule to move forward.
---
2026-03-24 00:00:00','excel_import','Master Jobs',57),
('crm-11656','South San Francisco USD
Junipero Serra ES 
(1) 36x40','South San Francisco USD','handoff',95,897625.9,852745,'2026-04-01','Diana',NULL,'Joe/Mike','(1) 36''x40'' Classroom with support rooms',0,'Yes
---
In estimating
---
2026-05-16 00:00:00','excel_import','Master Jobs',58),
('crm-11657','South San Francisco USD
 Monte Verde ES
(1) 36x40','South San Francisco USD','handoff',95,887625.9,843245,'2026-06-01','Diana',NULL,'Joe/Mike','(1) 36''x40'' Classroom with support rooms',0,'Yes
---
Customer taking to the board 10/6
---
2026-05-16 00:00:00','excel_import','Master Jobs',59),
('crm-11658','Whittier City SD Jackson ES (1) 24x40 & (1) 12x40 RR','Whittier City SD','handoff',95,389762.66,370275,'2026-06-23','Sandra',NULL,'Moanes/Brett','(1) 24x40 Double Classroom & (1) 12x40 RR',0,'Signed Proposal & LOI - 
following up on contract
Production not until Spring 2027
---
In DSA','excel_import','Master Jobs',60),
('crm-11659','Corning Union ESD
 Rancho Tehama ES 
(1) 48x40','Corning Union ESD','handoff',95,673367.01,639699,'2026-06-09','Diana',NULL,'Joe/Rod/Kevin','(1) 48''x40'' Classrooms',0,'3/25 Contract
---
In DSA','excel_import','Master Jobs',61),
('crm-11660','Corning Union ESD
Columbia Academy
(Community Day School) 
(1) 72x40','Corning Union ESD','award',80,953588.47,762871,'2026-07-31','Diana',NULL,'Joe/Daniel','(1) 72x40 Classroom Bldg',0,'3/26 Contract
---
LLB with United Building Contractors. District approved UBC in May 2025. Building production in Spring 2026.
---
1. Doors frames 6/4/26/ aluminum frames ? and Hardware not coming in till 6/19/26.                                                                                                                                                                                                                                                                                            ...','excel_import','Master Jobs',62)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;