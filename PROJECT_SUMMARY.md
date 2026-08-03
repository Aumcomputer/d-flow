# D-Flow Project Documentation

**D-Flow** คือระบบจัดการข้อมูลผู้ป่วย IPD หลังจำหน่าย (IPD Patient backend after patient discharge) เพื่อลดขั้นตอนการประสานงานและกระดาษ โดยมีหน้าจอแยกตามแต่ละแผนก (หอผู้ป่วย, ห้องยา, ศูนย์จำหน่าย, การเงิน) พร้อมระบบแจ้งเตือนแบบ Real-time

## 🛠 Tech Stack
- **Frontend**: React.js, Vite, Tailwind CSS, shadcn/ui
  - **UI/UX**: เน้นความทันสมัย (Light, modern theme, Glassmorphism, Micro-animations) ใช้ฟอนต์ Noto Sans Thai และออกแบบแนว Minimalist (รวมถึงโลโก้ SVG ใหม่)
- **Backend**: Node.js, Express.js
- **Database**: MariaDB (ระบบใช้งาน 2 ฐานข้อมูลคู่ขนาน)
  - `HIS_DB`: ฐานข้อมูลหลักของโรงพยาบาล (Read-only) ดึงข้อมูลผู้ป่วย แพทย์ และระบบ Login
  - `DFLOW_DB`: ฐานข้อมูลเฉพาะของโปรแกรมนี้ (Read/Write) สำหรับเก็บข้อมูลการอัปโหลดไฟล์ และสถานะ Workflow ของผู้ป่วย
- **Real-time Engine**: Socket.IO สำหรับการอัปเดตสถานะผู้ป่วยข้ามแผนกแบบทันทีโดยไม่ต้อง Refresh หน้าจอ
- **File Processing**: 
  - `pdf-parse`: ถอดข้อความและแยกประเภท PDF อัตโนมัติ พร้อมค้นหาเลขบัตรประชาชน (CID)
  - `sharp`: ย่อขนาดรูปภาพ (JPG/PNG) ไม่ให้ความกว้างเกิน 900px ก่อนบันทึก
- **Authentication**: JWT (JSON Web Token) หุ้มด้วย **HTTP-Only Cookie** ป้องกัน XSS

---

## 🏗 System Architecture

### 1. Database Connections (`server/config/database.js`)
- `getHisConnection()`: เชื่อมต่อ `HIS_DB` (tis620 charset) 
- `getDflowConnection()`: เชื่อมต่อ `DFLOW_DB` (utf8mb4 charset)

### 2. Authentication Flow (`server/routes/auth.js` & `client/src/contexts/AuthContext.jsx`)
- ผู้ใช้เข้าสู่ระบบโดยใช้ตาราง `opduser` จาก `HIS_DB` (รหัสผ่านใช้ Hash แบบ **MD5**)
- Backend สร้าง JWT Token และเซ็ตเป็น **HTTP-Only Cookie** อายุ 8 ชั่วโมง
- Frontend อ่านสถานะล็อกอินผ่าน API `GET /api/auth/me`

### 3. Workflow & WebSocket Engine (`server/routes/workflow.js` & `server/lib/socket.js`)
- **Real-time Sync**: เมื่อมีการส่งผู้ป่วยข้ามแผนก (เช่น จากศูนย์จำหน่ายส่งไปการเงิน) ระบบจะยิง WebSocket Event ชื่อ `workflow:updated` ไปยัง Client ทั้งหมด ทำให้หน้าต่างของแผนกปลายทาง (รวมถึงประวัติของหอผู้ป่วย) อัปเดตข้อมูลอัตโนมัติทันที
- **State Machine**: กระบวนการ Discharge ถูกเก็บสถานะไว้ที่ตาราง `an_detail` (คอลัมน์ `workflow_status` และ Date/Time stamp ต่างๆ) แบ่งเป็นสถานะ: `pharmacy`, `discharge_center`, `finance`, และ `completed`

### 4. Document Upload Flow (`server/routes/documents.js`)
- **อัปโหลด**: รองรับ Multipart/form-data 
- **การจัดการไฟล์**: สร้างโฟลเดอร์ตาม `AN` (`server/documents/{AN}/`) และเปลี่ยนชื่อไฟล์เป็นรูปแบบ `{AN}_[running_number].[ext]`
- **Auto-classification (PDF)**: อ่านข้อความใน PDF ถ้าระบุคำว่า "สิทธิ์ที่ใช้เบิก" จะจัดเป็นประเภท 2, ถ้าเจอ "Authen Code" จะจัดเป็นประเภท 3 พร้อมเปรียบเทียบเลขบัตรประชาชน (CID)
- **Manual-classification**: หากระบบไม่สามารถแยกประเภทได้ จะแสดงหน้าต่างให้ผู้ใช้ระบุประเภทไฟล์เอง (กำหนด `doc_type_id = NULL` ก่อน)

---

## 🚀 Modules Status

- [x] **Module 1: เวชระเบียน / ข้อมูลผู้ป่วย (Discharge Detail)** 
  - ค้นหาผู้ป่วยด้วย AN, แสดงข้อมูลผู้ป่วย สิทธิ์การรักษา วันที่ Admit ยอดค่าใช้จ่ายรวมและค้างชำระ
  - หน้าแสดงผลเอกสาร (Documents Tab), ประวัติยา (Drug Profile), Lab, ฯลฯ
  - ปุ่มส่งต่อแผนกไปยัง ห้องยา หรือ ศูนย์จำหน่าย (พร้อมเปลี่ยนสีและส่งสัญญาณ WebSocket)
- [x] **Module 2: หอผู้ป่วย (Ward)**
  - แบ่งเป็น 2 แท็บหลัก: "ผู้ป่วยที่ยังไม่ Discharge" และ "ผู้ป่วยที่ Discharge วันนี้"
  - มีระบบแสดงเวลาที่ Discharge, เวลาที่เสร็จสิ้น และ Badge แสดงสถานะแบบเรียลไทม์ (รอดำเนินการ, ห้องยา, ศูนย์จำหน่าย, การเงิน, เสร็จสิ้น) พร้อมสลับสีพื้นหลังแถวเป็นสีเขียวหากกระบวนการเสร็จสิ้น
  - ระบบสามารถปุ่มกดยกเลิก Discharge ซึ่งจะทำการล้างประวัติ Workflow ทั้งหมดใน `an_detail` ให้กลับเป็นค่าว่าง
- [x] **Module 3: ห้องยา (Pharmacy)**
  - แบ่งเป็น 2 แท็บ: "รอรับ" และ "ประวัติทำรายการ (History)"
  - แสดงผลเคสที่เข้ามาตามลำดับเวลา (เก่าสุดอยู่บนสุด) และคำนวณ "ระยะเวลารอคอย" ให้ในแท็บ History
- [x] **Module 4: ศูนย์จำหน่าย (Discharge Center)**
  - คล้ายกับหน้าห้องยา แต่มีปุ่มตัวเลือก 2 แบบ: "เสร็จสิ้น" และ "ส่งการเงิน"
  - แสดงผลเรียงลำดับเวลาเข้าคิวเช่นเดียวกัน
- [x] **Module 5: การเงิน (Finance)**
  - รับเคสต่อจากศูนย์จำหน่าย แสดงผลคล้ายหน้าห้องยา มีปุ่ม "เสร็จสิ้น" เป็นการจบกระบวนการทำงานของระบบ

---

## ⚙️ Development Setup

**1. Environment Variables (`.env`)**
ต้องสร้างไฟล์ `.env` ไว้ที่ Root directory:
```env
PORT=4000
JWT_SECRET=your_jwt_secret

# HIS Database (Read-Only)
HIS_DB_HOST=...
HIS_DB_PORT=3306
HIS_DB_USER=...
HIS_DB_PASSWORD=...
HIS_DB_NAME=hos

# D-Flow Database (Read/Write)
DFLOW_DB_HOST=...
DFLOW_DB_PORT=3306
DFLOW_DB_USER=...
DFLOW_DB_PASSWORD=...
DFLOW_DB_NAME=d-flow
```

**2. Database Migration**
โครงสร้างตารางของ `DFLOW_DB` ถูกเก็บไว้ที่ `server/migrations/*.sql`
สามารถรันรวดเดียวได้ผ่านคำสั่ง:
```bash
node server/migrations/run.js
```

**3. Run Application**
เปิด 2 Terminal เพื่อรันทั้งคู่พร้อมกัน
- **Backend**: `cd server && npm run dev`
- **Frontend**: `cd client && npm run dev`

---

*📝 Note: โปรเจกต์นี้ถูกสรุปข้อมูลล่าสุด ณ วันที่ 3 สิงหาคม 2026 (รวมการพัฒนา Workflow API, Real-time WebSockets, หน้าแดชบอร์ดแผนกต่างๆ และการอัปเดต UI/Logo)*
