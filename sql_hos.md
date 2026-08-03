
    
    
    //drug profile
    
SELECT 
    i.order_type AS `ชนิด`,
    i.rxdate AS `วันที่`,
    i.confirm_prepare AS `Prep.`,
    i.confirm_pay AS `Pay`,
    i.order_locked AS `L`,
    i.rxtime AS `เวลา`,
    w.name AS `ตึก`,
    i.order_no AS `เลขที่`,
    i.day_queue AS `Day-Q`,
    i.item_count AS `จำนวน`,
    i.amount AS `มูลค่า`,
    i.entry_staff AS `เจ้าหน้าที่`,
    t.name AS `Type`
FROM ipt_order_no i
LEFT JOIN ward w ON w.ward = i.ward
LEFT JOIN medpay_ipd_head m ON m.med_rx_number = i.order_no
LEFT JOIN ipt_medication_type t ON t.code = m.ipt_medication_type
WHERE i.an = '690028617' 
  AND i.order_type IN ('IRx', 'EMx', 'TRx', 'Hme', 'ATO', 'CRx', 'BCH')
ORDER BY i.rxdate DESC, i.rxtime DESC;




 //drug profile details

SELECT 
    o.item_no AS `ลำดับ`,
    CONCAT(s.name, ' ', s.strength, ' ', s.units) AS `ชื่อเวชภัณฑ์`,
    o.qty AS `จำนวนเบิก`,
    o.qty AS `จำนวนจ่าย`,
    o.qty AS `คงเหลือ`, 
    d.shortlist AS `วิธีใช้`,
    o.orderstatus AS `สถานะรายการ`,
    o.unitprice AS `ราคา`,
    o.sum_price AS `ราคารวม`
FROM opitemrece o
LEFT JOIN s_drugitems s ON s.icode = o.icode
LEFT JOIN drugusage d ON d.drugusage = o.drugusage
WHERE o.an = '690028617' 
  AND o.order_no = '15160124' -- แทนที่ด้วยเลขที่ใบสั่งที่ต้องการดูรายละเอียด
ORDER BY o.item_no;


//รายการคนไข้ทั้งหอผุ้ป่วย
SELECT 
    i.an AS `AN`, 
    i.hn AS `HN`, 
    CONCAT(p.pname, p.fname, ' ', p.lname) AS `ชื่อ-สกุล`,
    w.name AS `ตึก`,
    ia.bedno AS `เตียง`,
    pt.name AS `สิทธิการรักษา`, 
    aa.income AS `ค่าใช้จ่ายรวม`,
    aa.rcpt_money AS `ชำระแล้ว`,
    aa.paid_money AS `รอชำระ`,
    i.regdate AS `วันที่แอดมิด`,
    i.regtime AS `เวลาแอดมิด`
FROM ipt i
LEFT JOIN patient p ON p.hn = i.hn
LEFT JOIN iptadm ia ON ia.an = i.an
LEFT JOIN ward w ON w.ward = i.ward
LEFT JOIN pttype pt ON pt.pttype = i.pttype
LEFT JOIN an_stat aa ON aa.an = i.an
WHERE i.ward = '48' 
  AND i.dchstts IS NULL 
ORDER BY i.regdate, i.regtime;


//รายการค่าใช้จ่ายแยกตามหมวดหมู่
SELECT 
    o.income AS `CODE`,
    i.name AS `ชื่อรายการ`,
    SUM(o.sum_price) AS `จำนวนเงินรวม`,
    SUM(IF(o.paidst = '03', o.sum_price, 0)) AS `รอชำระ`
FROM opitemrece o
LEFT JOIN income i ON i.income = o.income
WHERE o.an = '690028617' -- เปลี่ยนเป็นเลข AN ของผู้ป่วยที่ต้องการดูข้อมูล
GROUP BY 
    o.income, 
    i.name
ORDER BY 
    o.income;
    
    
//รายละเอียดค่าใช้จ่ายแยกตามหมวดหมู่    
SELECT 
    o.rxdate AS `วันที่สั่ง`,
    o.rxtime AS `เวลา`,
    o.icode AS `รหัสรายการ`,
    COALESCE(d.name, n.name) AS `ชื่อรายการ`,
    o.qty AS `จำนวน`,
    o.unitprice AS `ราคาต่อหน่วย`,
    o.sum_price AS `ราคารวม`
FROM opitemrece o
LEFT JOIN drugitems d ON d.icode = o.icode
LEFT JOIN nondrugitems n ON n.icode = o.icode
WHERE o.an = '690028617' 
  AND o.income = '01'
ORDER BY o.rxdate DESC, o.rxtime DESC;


//รายการ Lab
SELECT h.confirm_report ,
    h.lab_order_number, 
    h.order_date, h.order_time, 
	h.receive_date, h.receive_time,
	h.report_date, h.report_time,
    d.name AS doctor_name, 
    h.form_name, 
    group_concat(distinct s.lab_name separator ', ') as lab_name_cc,
    SUM(s.price) AS total_lab_price
FROM lab_head h
LEFT JOIN doctor d ON d.code = h.doctor_code
LEFT JOIN lab_order_service s ON s.lab_order_number = h.lab_order_number
WHERE h.vn = '690028617'
GROUP BY 
    h.lab_order_number, h.hn, h.vn, h.order_date, h.order_time, 
    h.receive_time, h.report_time, d.name, h.form_name
ORDER BY 
    h.order_date, h.order_time;