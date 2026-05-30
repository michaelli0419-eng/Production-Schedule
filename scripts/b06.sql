INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11661','Pasadena USD
Franklin ES
 (1) 96x40 Admin','Pasadena USD','handoff',95,8750000,8312500,'2025-05-08','Sandra',NULL,'Joe/Rod','Admin, Kitchen, MP',0,'Design Contract received on 4/29 for Engineering, Sandra following up everyday
---
Submitted Final Costs with Piggyback breakdowns and they are 
beginning to return them reviewed.
---
1. Squared up flooring -  Still waiting on approval to order cove base special order                                                                                                                                                                                                                                     ...','excel_import','Master Jobs',63),
('crm-row-64','Pasadena USD
Franklin ES
 (1) 84x40 MPR 
(1) 132x60 Kitchen','Pasadena USD','handoff',95,8750000,8312500,'2025-05-08','Sandra',NULL,'Joe/Rod','Admin, Kitchen, MP',0,'Design Contract received on 4/29 for Engineering, Sandra following up everyday
---
Submitted Final Costs with Piggyback breakdowns and they are 
beginning to return them reviewed.
---
Open Submittals:                                                                                                                                                                                                                                                                                                         ...','excel_import','Master Jobs',64),
('crm-11662','Helendale Helendale (1) 48x40','Helendale SD','proposal',55,260434.8,143239,'2026-06-01','Sandra',NULL,'Gino/James','(1) 48x40 Classroom',0,'Bid
---
Working on piggyback - meeting 5/13/26.','excel_import','Master Jobs',65),
('crm-11663','Placentia Yorba Linda Casa Loma Expanded Learning (1) 12x60 RR','Placentia Yorba Linda','proposal',55,335998.01,184799,'2026-08-24','Sandra',NULL,'Moanes/Mark','(1) 12x60 TB',0,'Lease-leaseback bid - first week of June
---
DSA Approved pending site bid so they can award us through the lease lease back contract','excel_import','Master Jobs',66),
('crm-11664','San Diego Gage (2) 36x40','San Diego USD','proposal',55,508735.27,279804,'2027-05-28','Diana',NULL,'Uzi/James','(2) 36''x40'' with single user restroom',0,'Bid
---
DSA comments were received this week. AOR resubmitting by the end of the month','excel_import','Master Jobs',67),
('crm-11665','MMC (15) 24x40 Right Hands','Mobile Modular','handoff',95,7654077,7271373,'2026-04-01','Adela',NULL,'Jack','(75) 24''x40'' Classroom Buildings',0,'PO
---
Revised proposal being presented to the customer
---
FOB Gate','excel_import','Master Jobs',68),
('crm-row-69','MMC (10) 24x40 Right Hands','Mobile Modular','handoff',95,7654077,7271373,'2026-04-01','Adela',NULL,'Jack','(75) 24''x40'' Classroom Buildings',0,'PO
---
Revised proposal being presented to the customer
---
FOB Gate','excel_import','Master Jobs',69),
('crm-row-70','MMC (25) 24x40 Left Hands','Mobile Modular','handoff',95,7654077,7271373,'2026-04-01','Adela',NULL,'Jack','(75) 24''x40'' Classroom Buildings',0,'PO
---
Revised proposal being presented to the customer
---
FOB Gate','excel_import','Master Jobs',70),
('crm-row-71','MMC (25) 24x40 Right Hands','Mobile Modular','handoff',95,7654077,7271373,'2026-04-01','Adela',NULL,'Jack','(75) 24''x40'' Classroom Buildings',0,'PO
---
Revised proposal being presented to the customer','excel_import','Master Jobs',71),
('crm-11666','Tustin USD Beswick  (1) 24x40','Tustin USD','handoff',95,154046.05,146344,'2026-08-01','Sandra',NULL,'Moanes/Mark','(1) 24’x40’',0,'NOI received on 5/6/26 to 
procure materials
---
Submitted Plans to architect received some updates on 2/12/26','excel_import','Master Jobs',72)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;