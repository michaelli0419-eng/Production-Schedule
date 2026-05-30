INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11624','Tehama County DoE
Gerber ES
Building A (1) 168X40
Building B (1) 156X40 
Building C (1) 84X40 (MTU)
(34 floors)','Tehama County DoE','award',80,6969553.68,5575643,'2025-12-01','Diana',NULL,'Joe/James','BUILDING A (1) 168X40
BUILDING B (1) 156X40 
BUILDING C (1) 84X40 MEDICAL THERAPY UNIT (MTU)',0,'LLB contractor to be selected
in late July.
---
Adela to call Judy on 5/6/26 to confirm timing','excel_import','Master Jobs',33),
('crm-11627','Keppel USD
Lake Los Angeles ES
(3) 24x40 Classroom Bldgs','Keppel Union SD','handoff',95,435627,413846,'2026-03-02','Sandra',NULL,'Gino/James','(3) 24''x40'' Standard Classroom',0,'PO
---
Will be DSA approved but do not want deliver till spring 2026','excel_import','Master Jobs',34),
('crm-11628','Keppel USD 
Pearblossom ES
(3) 24x40 Classroom Bldgs','Keppel Union SD','handoff',95,435627,413846,'2025-12-15','Sandra',NULL,'Gino/James','(3) 24''x40'' Standard Classroom',0,'PO
---
DSA app not till late July
---
We are missing door hardware: Door Locks. Units moved to the Yard without','excel_import','Master Jobs',35),
('crm-11629','Pleasant Valley SD 
Valle Lindo ES 
(CAPE Charter School)
(1) 24x40 Office Building','Pleasant Valley SD','handoff',95,246213,233902,'2026-06-01','Joe',NULL,'Uzi/James','(1) 24x40 Office/Resource Building',0,'PO
---
DSA appt 12/2/2025
---
Building was completed last week with missing material. Unit was moved off line to the yard.                                                                                                                                                                                                                                                                                  1. received building paint                                                                           ...','excel_import','Master Jobs',36),
('crm-11630','Action Day Schools 
Lincoln 
(1) 36x40 Child Care Center','Action Day Schools','handoff',95,572840,544198,'2026-06-01','Joe',NULL,'Joe/James','(1) 36X40 Child Care Center',0,'PO
---
Ryan to submit drawings for HCD review and approval.
---
1. Need Interior HVAC Curb Missing , ETA 5/26/26                                                                                                                                                                                                                                                                                                                                                                                                 ...','excel_import','Master Jobs',37),
('crm-11631','Menifee USD Menifee ES (1)168x40 (1)156x40 (1)84x40 (1)108x40 (1)72x40 (1)120x40 - 59 Floors','Menifee USD','proposal',55,10198770.01,5609324,'2028-07-01','Diana',NULL,'Daniel / Kenny','(1)168'' x 40'' (1)108'' x 40'' (1)156'' x 40'' (1)72'' x 40'' (1)84'' x 40'' (1)120'' x 40''',0,'In DSA','excel_import','Master Jobs',38),
('crm-11636','Feaster Charter Chula Vista (1) 48x40','Chula Vista USD','lead',15,396510.73,59477,'2026-02-18','Diana',NULL,'Uzi/Ryan','(1) 48x40',0,'P&P sent (2/26).
Received executed contract (3/3).
---
2026-04-01 00:00:00','excel_import','Master Jobs',39),
('crm-11638','Muroc JUSD
Boron HS
(1) 12x40 B-2 RR','Muroc Joint USD','handoff',95,276363.15,262545,'2025-11-01','Diana',NULL,'Gino/Mark','(1) 12x40 Restroom Model B-2',0,'Fully executed agreement received 12-16-25
---
SCM generating CCD for adding the HVAC unit
---
Week of: 03/16 - 03/20','excel_import','Master Jobs',40),
('crm-11639','Ventura Montalvo (1) 120x40','Ventura USD','handoff',95,1200942.43,1140895,'2026-04-04','Diana',NULL,'Joe/Rod','(1) 120x40',0,'Per District, the project is on “Hold” status until further notice
---
Scope has been confirmed we are waiting on the AOR''s response to 4 clarification items. Soils report has been povided.
---
JOB was placed on-hold per the District','excel_import','Master Jobs',41),
('crm-11640','South San Francisco USD
District Office Annex
(1) 24x60','South San Francisco USD','handoff',95,416593.32,395764,'2026-03-26','Diana',NULL,'Joe/Daniel','(1) 24''x60'' Office Building',0,'Yes
---
8.7.25 District provided a LOI, will have signed proposal 8.24.2025
---
1. wall mount HVAC (arrived)                                                                                                                                                                                                                                                                                                                                                                                                     ...','excel_import','Master Jobs',42)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;