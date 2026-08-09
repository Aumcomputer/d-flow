# D-Flow Project Documentation

**D-Flow** คือระบบจัดการข้อมูลผู้ป่วย IPD หลังจำหน่าย (IPD Patient backend after patient discharge) เพื่อลดขั้นตอนการประสานงานและกระดาษ โดยมีหน้าจอแยกตามแต่ละแผนก (หอผู้ป่วย, ห้องยา, ศูนย์จำหน่าย, การเงิน) พร้อมระบบแจ้งเตือนแบบ Real-time

## 🛠 Tech Stack
- **Frontend**: React.js, Vite, Tailwind CSS, shadcn/ui
  - **UI/UX**: เน้นความทันสมัย (Light, modern theme, Glassmorphism, Micro-animations) ใช้ฟอนต์ Noto Sans Thai และออกแบบแนว Minimalist (รวมถึงโลโก้ SVG ใหม่)
- **Backend**: Node.js, Express.js
- **Database**: MariaDB (ระบบใช้งาน 2 ฐานข้อมูลคู่ขนาน)
  - `HIS_DB`: ฐานข้อมูลหลักของโรงพยาบาล (Read-only) ดึงข้อมูลผู้ป่วย แพทย์ และระบบ Login
  - `DFLOW_DB`: ฐานข้อมูลเฉพาะของโปรแกรมนี้ (Read/Write) สำหรับเก็บข้อมูลการอัปโหลดไฟล์ และสถานะ Workflow ของผู้ป่วย
- **Real-time Engine**: Socket.IO ผสานกับ **Redis Adapter** สำหรับรองรับการกระจายโหลด (Load Balancer / Multiple Instances)
- **State Store**: Redis (สำหรับเก็บสถานะระบบ Lock แบบ Real-time ข้ามเซิร์ฟเวอร์)
- **File Processing**: 
  - `pdf-parse`: ถอดข้อความและแยกประเภท PDF อัตโนมัติ พร้อมค้นหาเลขบัตรประชาชน (CID)
  - `sharp`: ย่อขนาดรูปภาพ (JPG/PNG) ไม่ให้ความกว้างเกิน 900px ก่อนบันทึก
- **Authentication**: JWT (JSON Web Token) หุ้มด้วย **HTTP-Only Cookie** ป้องกัน XSS พร้อมระบบ Autologin เชื่อม EMR Scan

---

## 🏗 System Architecture

### 1. Database Connections (`server/config/database.js`)
- `getHisConnection()`: เชื่อมต่อ `HIS_DB` (tis620 charset) 
- `getDflowConnection()`: เชื่อมต่อ `DFLOW_DB` (utf8mb4 charset)
- **Redis Connection**: ใช้ `redis` Client ควบคู่กับ Socket.IO Pub/Sub

### 2. Authentication Flow (`server/routes/auth.js` & `client/src/contexts/AuthContext.jsx`)
- ผู้ใช้เข้าสู่ระบบโดยใช้ตาราง `opduser` จาก `HIS_DB` (รหัสผ่านใช้ Hash แบบ **MD5**)
- Backend สร้าง JWT Token และเซ็ตเป็น **HTTP-Only Cookie** อายุ 8 ชั่วโมง
- ระบบเชื่อมต่อกับ EMR Scan ผ่าน API `getTokenAutologin` ด้วย Secret Key

### 3. Workflow & WebSocket Engine (`server/routes/workflow.js` & `server/lib/socket.js`)
- **Real-time Sync**: เมื่อมีการส่งผู้ป่วยข้ามแผนก ระบบจะยิง WebSocket Event ชื่อ `workflow:updated` ไปยัง Client ทั้งหมด
- **State Machine**: กระบวนการ Discharge ถูกเก็บสถานะไว้ที่ตาราง `an_detail` แบ่งเป็นสถานะ: `pharmacy`, `discharge_center`, `finance`, และ `completed`
- **Lock & Presence System**: ป้องกันปัญหาเจ้าหน้าที่ทำงานซ้ำซ้อนกันในผู้ป่วยรายเดียวกัน (Race Condition)
  - เมื่อมีคนเข้าดู `dcdetail` ระบบจะส่ง Event สั่งล็อก (Lock) และนำชื่อไปบันทึกลง **Redis**
  - หน้าจอส่วนกลางจะแสดงสถานะล็อกด้วยแถบ "สีส้ม" พร้อมคอลัมน์ "กำลังตรวจสอบโดย" แบบ Real-time
  - หากคนอื่นพยายามคลิกเข้าดู จะมี Popup แจ้งเตือนสกัดกั้นทันที

### 4. Document Upload Flow (`server/routes/documents.js`)
- **อัปโหลด**: รองรับ Multipart/form-data 
- **การจัดการไฟล์**: สร้างโฟลเดอร์ตาม `AN` (`server/documents/{AN}/`)
- **Auto-classification (PDF)**: อ่านข้อความใน PDF เพื่อแยกประเภทอัตโนมัติตาม Keyword

---

## 🚀 Modules Status

- [x] **Module 1: เวชระเบียน / ข้อมูลผู้ป่วย (Discharge Detail)** 
  - ค้นหาผู้ป่วยด้วย AN, แสดงข้อมูลผู้ป่วยจาก HOSxP
  - ระบบตรวจสอบอัตโนมัติ (Automated Audit) หาสิ่งซ้ำซ้อนและประเมินเอกสาร
  - มีปุ่มส่งต่อแผนกไปยัง ห้องยา, ศูนย์จำหน่าย, หรือ ส่งการเงิน
  - (Update) มีระบบอัปเดตสถานะ Discharge HOSxP แบบอัตโนมัติ (Polling) ระหว่างรอดำเนินการ
- [x] **Module 2: หอผู้ป่วย (Ward)**
  - ค้นหาและดูผู้ป่วยประจำหอผู้ป่วย มีระบบแสดง Workflow Badge
- [x] **Module 3: ห้องยา (Pharmacy)**
  - แบ่งแท็บรอรับและประวัติย้อนหลัง พร้อมคำนวณระยะเวลารอคอย
- [x] **Module 4: ศูนย์จำหน่าย (Discharge Center)**
  - แสดงผลเคสเรียงตามเวลาที่เข้ามา มีปุ่ม "ส่งการเงิน" หรือ "เสร็จสิ้น"
  - (Update) ตัดคอลัมน์เวลา Discharge ออกเพื่อความกว้างสบายตา, เพิ่มคอลัมน์ "กำลังตรวจสอบโดย" ให้เข้ากับระบบ Lock 
- [x] **Module 5: การเงิน (Finance)**
  - รับเคสต่อจากศูนย์จำหน่าย ปิดจบกระบวนการ

---

## ⚙️ Development Setup

**1. Environment Variables (`.env`)**
ต้องสร้างไฟล์ `.env` ไว้ที่ Root directory:
```env
PORT=4000
JWT_SECRET=your_jwt_secret

# HIS Database
HIS_DB_HOST=...
HIS_DB_PORT=3306
HIS_DB_USER=...
HIS_DB_PASSWORD=...
HIS_DB_NAME=hos

# D-Flow Database
DFLOW_DB_HOST=...
DFLOW_DB_PORT=3306
DFLOW_DB_USER=...
DFLOW_DB_PASSWORD=...
DFLOW_DB_NAME=d-flow

# Redis Configuration (Required for Load Balance & Locks)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=...

# Other
UPLOAD_DIR=.uploads/documents
MAX_FILE_SIZE=10485760
AUTOLOGIN_SECRET=...
```

**2. Run Application**
เปิด 2 Terminal เพื่อรันทั้งคู่พร้อมกัน
- **Backend**: `cd server && npm run dev`
- **Frontend**: `cd client && npm run dev`

---

*📝 Note: โปรเจกต์นี้ถูกสรุปข้อมูลล่าสุด ณ วันที่ 9 สิงหาคม 2026 (ครอบคลุมการเชื่อมต่อ Redis, ระบบ Lock ป้องกันการทำงานซ้ำซ้อน, และการอัปเดต UI/UX เพิ่มเติม)*
