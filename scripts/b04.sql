INSERT INTO sales_pipeline_deals (id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES
('crm-11642','Romoland SD
Boulder Ridge ES
(2) 24x40s (Left Handed)','Romoland SD','handoff',95,335647.68,318865,'2025-11-21','Diana',NULL,'Joe/Daniel','(2) 24'' x 40'' classrooms',0,'PO
---
To DSA by 9/1
---
3/25/2026
No crane needed. Wood foundation.','excel_import','Master Jobs',43),
('crm-11643','Cerritos College (2) 48x60 & (1) 24x60','Cerritos College','handoff',95,2389774.49,2270286,'2026-08-31','Sandra',NULL,'Moanes/Brett','(2) 48x60 and (1) 24x60 TK Buildings',0,'Contract fully executed;
Change orders in process
---
Jonathan executed contract pending bonds and insurance
PM working on change orders
---
1. In-plant and Lab are supposed to be at Factory tomorrow to ID steel. I will only be able to cut steel and not assemble.                                                                                                                                                                                                                                          ...','excel_import','Master Jobs',44),
('crm-11644','San Diego Cooperative Charter (1) 36x40','San Diego USD','proposal',55,270248.43,148637,'2026-07-31','Diana',NULL,'Uzi/James','(1) 36''x40'' w/ single user RR',0,'Bid on 4/9/26 
District taking to the board 5/18; 
PO coming 5/19/26 - needs update
---
The proposal was provided the customer is exploring their options due to budget. Might need to lease.
---
1. No Job card to build, no IOR yet, no LOR yet. (Uzi- Currently on-going)                                                                                                                                                                                                                                     ...','excel_import','Master Jobs',45),
('crm-11645','Menifee Ridgemoor Restroom','Menifee Union SD','handoff',95,1105704.69,1050419,'2026-06-05','Diana',NULL,'Uzi/Rod','(4) standard 24’ x 40’ classrooms, (1) 36''x40'' Classroom  (1) 12’ x 40’ restroom relocatable',0,'Signed agreement received. Board approval obtained
---
To DSA by 12/15
---
Just needs partitions , Delivered (5/20)','excel_import','Master Jobs',46),
('crm-row-47','Menifee Ridgemoor (4) 24x40, (1) 36x40 & (1) 12x40 RR','Menifee Union SD','handoff',95,1105704.69,1050419,'2026-06-05','Diana',NULL,'Uzi/Kenny/Jack','(4) standard 24’ x 40’ classrooms, (1) 36''x40'' Classroom  (1) 12’ x 40’ restroom relocatable',0,'Signed agreement received. Board approval obtained
---
To DSA by 12/15
---
1.Classroom are in the yard,  restroom building still online.                                                                                                                                                                                                                                                                                                                                                                         ...','excel_import','Master Jobs',47),
('crm-11646','Long Beach Poly (1) 12x80 Concession','Long Beach USD','handoff',95,710083.39,674579,'2026-04-02','Sandra',NULL,'Moanes/Daniel','(1) 12’x80’ Concession Building',0,'Site bid to go out early March

Needs update
---
Met with PM onsite and they anticipate delivery in Decemeber
---
Job is a custom project and will needs lots of coordination with factory subcontracts.','excel_import','Master Jobs',48),
('crm-11647','Fullerton Park Jr High (2) 24x40','Fullerton SD','lead',15,337086.71,50563,'2026-06-26','Sandra',NULL,'Moanes/James','(2) 24x40 Classroom Building',0,'PO
---
Pending DSA Approval','excel_import','Master Jobs',49),
('crm-11648','Inglewood Oak St Prep Phase 2 (7) 36x40, (3) 24x40 & (1) 12x40 RR','Inglewood USD','handoff',95,4465605.11,4242325,'2026-08-01','Sandra',NULL,'Moanes/Mark','(1) 12x40 RR, (7) 36x40 Tk (3) 24x40 Classroom Bldg',0,'Fully executed agreement received 5/1/26
---
Balfour has requested breakdown of why cost went up so much
---
1. Doors, Frames andHardware, ETA: 6/12/26                                                                                                                                                                                                                                                                                                                                                          ...','excel_import','Master Jobs',50),
('crm-11649','Imperial County Office of Ed IVCEC - (1) 120x40 - 10 Floors','Imperial County','proposal',55,0,0,'2026-10-05','Diana',NULL,'Daniel / Kenny','120'' x 40'' classroom buildings',0,'Need update - now DSA approved
---
Likely to start in January 2027.','excel_import','Master Jobs',51),
('crm-11650','Mobile Modular Crestview Prep','Mobile Modular','handoff',95,4271574.32,4057996,'2027-08-01','Diana',NULL,'TBD/Ramon','(1) 132'' x 40'' 2-story Building',0,'Design PO has been received
---
Repricing of project to start 3/23','excel_import','Master Jobs',52)
ON CONFLICT (id) DO UPDATE SET opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,notes=EXCLUDED.notes;