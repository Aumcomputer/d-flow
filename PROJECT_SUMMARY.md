# D-Flow Project Documentation

**D-Flow** คือระบบจัดการข้อมูลผู้ป่วย IPD หลังจำหน่าย (IPD Patient backend after patient discharge) 

## 🛠 Tech Stack
- **Frontend**: React.js, Vite, Tailwind CSS, shadcn/ui
  - **UI/UX**: เน้นความทันสมัย (Light, modern theme, Glassmorphism, Micro-animations) ใช้ฟอนต์ Noto Sans Thai
- **Backend**: Node.js, Express.js
- **Database**: MariaDB (ระบบใช้งาน 2 ฐานข้อมูลคู่ขนาน)
  - `HIS_DB`: ฐานข้อมูลหลักของโรงพยาบาล (Read-only) ดึงข้อมูลผู้ป่วย แพทย์ และระบบ Login
  - `DFLOW_DB`: ฐานข้อมูลเฉพาะของโปรแกรมนี้ (Read/Write) สำหรับเก็บข้อมูลการอัปโหลดไฟล์
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
- Frontend อ่านสถานะล็อกอินผ่าน API `GET /api/auth/me` (ใช้ตั้งค่า `withCredentials: true` ใน Axios)

### 3. Document Upload Flow (`server/routes/documents.js`)
- **อัปโหลด**: รองรับ Multipart/form-data 
- **การจัดการไฟล์**: 
  - สร้างโฟลเดอร์ตาม `AN` (`server/documents/{AN}/`)
  - เปลี่ยนชื่อไฟล์เป็นรูปแบบ `{AN}_[running_number].[ext]` (เช่น `690028386_001.pdf`)
- **Auto-classification (PDF)**:
  - อ่านข้อความใน PDF ถ้าระบุคำว่า "สิทธิ์ที่ใช้เบิก" จะจัดเป็นประเภท 2, ถ้าเจอ "Authen Code" จะจัดเป็นประเภท 3
  - ถอดรหัสเลข 13 หลักเพื่อดึง CID นำไปแสดงเปรียบเทียบกับ CID ของผู้ป่วย
- **Manual-classification**:
  - หากระบบไม่สามารถแยกประเภทได้ (เช่น เป็นไฟล์รูปภาพ หรือ PDF ที่ไม่มีคีย์เวิร์ด) ระบบจะบันทึกค่าเป็น `doc_type_id = NULL` แล้วส่งให้ Frontend เด้ง Dialog ให้ผู้ใช้เลือกประเภทเอง

### 4. Patient Image Serving (`server/routes/patients.js`)
- ระบบดึงรูปผู้ป่วยจากตาราง `patient_image` ใน `HIS_DB` (ซึ่งเก็บรูปเป็น Binary `longblob`)
- Backend ให้บริการภาพผ่าน `GET /api/patients/:hn/image` และส่งกลับเป็น HTTP Image stream เพื่อให้นำไปใส่ในแท็ก `<img src="..."/>` ได้โดยตรง (Browser จะแนบ Auth Cookie ให้เอง)

---

## 🚀 Modules Status

- [x] **Module 1: เวชระเบียน (Medical Records)** 
  - ค้นหาผู้ป่วยด้วย AN, แสดงข้อมูล/รูปภาพผู้ป่วย, เช็คความครบถ้วนของเอกสาร (Completeness)
  - ระบบ Drag & Drop อัปโหลดไฟล์ 5 ประเภท
- [ ] **Module 2: หอผู้ป่วย (Ward)** - (สร้าง Placeholder ไว้แล้ว)
- [ ] **Module 3: ห้องยา (Pharmacy)** - (สร้าง Placeholder ไว้แล้ว)
- [ ] **Module 4: ศูนย์จำหน่าย (Discharge)** - (สร้าง Placeholder ไว้แล้ว)
- [ ] **Module 5: การเงิน (Finance)** - (สร้าง Placeholder ไว้แล้ว)

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
เปิด 2 Terminal เพื่อรันทั้งคู่พร้อมกัน (หรือสร้าง script มัดรวมไว้ภายหลัง)
- **Backend**: `cd server && npm run dev`
- **Frontend**: `cd client && npm run dev`

---

*📝 Note: โปรเจกต์นี้ถูกสรุปข้อมูลล่าสุด ณ วันที่ 20 กรกฎาคม 2026 โปรดอัปเดตไฟล์นี้เมื่อมีการพัฒนาโครงสร้างหลักหรือ Module ใหม่เพิ่มเติม*
