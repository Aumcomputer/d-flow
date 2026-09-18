import React from 'react';
import { Activity, Pill, Building2, Wallet, CheckCircle2, Home } from 'lucide-react';

export default function TimelineTab({ details }) {
  if (!details || !details.discharge_date) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground bg-white rounded-2xl shadow-sm border border-border">
        ยังไม่มีข้อมูลการ Discharge
      </div>
    );
  }

  const nodes = [];

  // 1. Discharge (หอผู้ป่วย)
  nodes.push({
    key: 'discharge',
    label: 'Discharge',
    date: details.discharge_date,
    by: details.discharge_by_name || details.discharge_by,
    icon: Activity,
    color: 'bg-blue-500'
  });

  const hasHm = details.chk_hm === 1 || details.pharmacy_pack_date || details.pharmacy_done_date || details.sent_pharmacy_date || details.workflow_status === 'pharmacy_prepare' || details.workflow_status === 'pharmacy';

  // 2. เช็คยาเสร็จ (แสดงเฉพาะกรณีมียา HM)
  if (hasHm) {
    const isPackDone = !!details.pharmacy_pack_date;
    nodes.push({
      key: 'pharmacy_pack',
      label: 'เช็คยาเสร็จ',
      date: details.pharmacy_pack_date || null,
      by: details.pharmacy_pack_by_name || details.pharmacy_pack_by || (details.workflow_status === 'pharmacy_prepare' ? 'กำลังดำเนินการ' : null),
      icon: Pill,
      color: isPackDone ? 'bg-cyan-600' : (details.workflow_status === 'pharmacy_prepare' ? 'bg-cyan-400' : 'bg-slate-300')
    });
  }

  // 3. ศูนย์จำหน่ายเสร็จ
  const isDcDone = !!details.dc_done_date;
  const isDcCurrent = details.workflow_status === 'discharge_center';
  const showDc = isDcDone || isDcCurrent || ['finance', 'pharmacy', 'ward_waiting', 'completed'].includes(details.workflow_status) || hasHm;

  if (showDc) {
    nodes.push({
      key: 'dc',
      label: 'ศูนย์จำหน่ายเสร็จ',
      date: details.dc_done_date || null,
      by: details.dc_done_by_name || details.dc_done_by || (isDcCurrent ? 'กำลังดำเนินการ' : null),
      icon: Building2,
      color: isDcDone ? 'bg-purple-500' : (isDcCurrent ? 'bg-purple-400' : 'bg-slate-300')
    });
  }

  // 4. การเงินเสร็จ (แสดงเมื่อมียอดต้องชำระ)
  const hasPayment = details.chk_payment === 1 || details.finance_done_date || details.sent_finance_date || details.workflow_status === 'finance';
  const isFinanceDone = !!details.finance_done_date;
  if (hasPayment) {
    nodes.push({
      key: 'finance',
      label: 'การเงินเสร็จ',
      date: details.finance_done_date || null,
      by: details.finance_done_by_name || details.finance_done_by || (details.workflow_status === 'finance' ? 'กำลังดำเนินการ' : null),
      icon: Wallet,
      color: isFinanceDone ? 'bg-amber-500' : (details.workflow_status === 'finance' ? 'bg-amber-400' : 'bg-slate-300')
    });
  }

  // 5. จ่ายยาเสร็จ (แสดงเมื่อมียา HM)
  if (hasHm) {
    const isPharmacyDone = !!details.pharmacy_done_date;
    nodes.push({
      key: 'pharmacy',
      label: 'จ่ายยาเสร็จ',
      date: details.pharmacy_done_date || null,
      by: details.pharmacy_done_by_name || details.pharmacy_done_by || (details.workflow_status === 'pharmacy' ? 'กำลังดำเนินการ' : null),
      icon: Pill,
      color: isPharmacyDone ? 'bg-teal-500' : (details.workflow_status === 'pharmacy' ? 'bg-teal-400' : 'bg-slate-300')
    });
  }

  // 6. คนไข้กลับบ้าน
  const isCase1 = details.chk_hm === 0 && details.chk_payment === 0;
  if (isCase1) {
    if (details.ward_done_date) {
      nodes.push({
        key: 'home',
        label: 'คนไข้กลับบ้าน',
        date: details.ward_done_date,
        by: details.ward_done_by_name || details.ward_done_by,
        icon: Home,
        color: 'bg-emerald-500'
      });
    } else {
      nodes.push({
        key: 'home',
        label: 'คนไข้กลับบ้าน',
        date: null,
        by: details.workflow_status === 'ward_waiting' ? 'รอหอผู้ป่วยยืนยัน' : 'รอดำเนินการ',
        icon: Home,
        color: details.workflow_status === 'ward_waiting' ? 'bg-emerald-400' : 'bg-slate-300'
      });
    }
  } else {
    const isCompleted = details.workflow_status === 'completed';
    const completedDate = details.pharmacy_done_date || details.finance_done_date || details.dc_done_date;
    const completedBy = details.pharmacy_done_by_name || details.pharmacy_done_by || details.finance_done_by_name || details.finance_done_by || details.dc_done_by_name || details.dc_done_by;
    nodes.push({
      key: 'home',
      label: 'คนไข้กลับบ้าน',
      date: isCompleted ? completedDate : null,
      by: isCompleted ? completedBy : 'รอดำเนินการ',
      icon: isCompleted ? CheckCircle2 : Home,
      color: isCompleted ? 'bg-emerald-500' : 'bg-slate-300'
    });
  }

  const getDurationText = (start, end, nextNodeKey) => {
    if (!start || !end) return null;
    const diff = new Date(end) - new Date(start);
    if (diff < 0) return null;
    if (nextNodeKey === 'home' && diff === 0) return null;

    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    const timeStr = hours > 0 ? `${hours} ชม. ${m} นาที` : `${m} นาที`;

    if (nextNodeKey === 'pharmacy_pack') return `ห้องยาเช็คยาใช้เวลา ${timeStr}`;
    if (nextNodeKey === 'dc') return `ศูนย์จำหน่ายใช้เวลา ${timeStr}`;
    if (nextNodeKey === 'finance') return `การเงินใช้เวลา ${timeStr}`;
    if (nextNodeKey === 'pharmacy') return `ห้องยาจ่ายยาใช้เวลา ${timeStr}`;
    if (nextNodeKey === 'home') return `รอคนไข้กลับบ้าน ${timeStr}`;
    return timeStr;
  };

  const finalNode = nodes[nodes.length - 1];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
            <Activity className="w-5 h-5 text-blue-500" />
            Timeline การส่งต่อแผนก
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            แสดงลำดับเวลาและระยะเวลารอคอยในแต่ละขั้นตอน {hasHm ? '(Discharge → เช็คยาเสร็จ → ศูนย์จำหน่ายเสร็จ → การเงินเสร็จ → จ่ายยาเสร็จ → คนไข้กลับบ้าน)' : '(Discharge → ศูนย์จำหน่ายเสร็จ → การเงินเสร็จ → คนไข้กลับบ้าน)'}
          </p>
        </div>
        {details.ward_done_date ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold self-start sm:self-auto">
            <Home className="w-4 h-4 text-emerald-600" />
            <span>คนไข้กลับบ้าน: {new Date(details.ward_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
          </div>
        ) : details.workflow_status === 'completed' && finalNode?.date ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>คนไข้กลับบ้าน: {new Date(finalNode.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
          </div>
        ) : details.workflow_status === 'ward_waiting' ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold self-start sm:self-auto">
            <Home className="w-4 h-4 text-amber-600" />
            <span>รอหอผู้ป่วยยืนยันคนไข้กลับบ้าน</span>
          </div>
        ) : null}
      </div>
      
      <div className="p-8 overflow-x-auto">
        <div className="flex min-w-max items-start pt-4 pb-8">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const hasNext = index < nodes.length - 1;
            const nextNode = hasNext ? nodes[index + 1] : null;
            const waitTime = hasNext ? getDurationText(node.date, nextNode?.date, nextNode?.key) : null;

            return (
              <div key={index} className="flex-1 relative flex flex-col items-center min-w-[220px] group">
                {/* Connecting Line */}
                {hasNext && (
                  <div className="absolute top-6 left-[50%] w-full h-1 bg-slate-300 z-0 group-hover:bg-blue-300 transition-colors"></div>
                )}
                
                {/* Wait Time Badge */}
                {hasNext && waitTime && (
                  <div className="absolute top-1 left-[100%] -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-700 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm z-10 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors">
                    {waitTime}
                  </div>
                )}

                {/* Node Icon */}
                <div className={`w-12 h-12 rounded-full ${node.color} text-white flex items-center justify-center shadow-md z-10 ring-4 ring-white`}>
                  <Icon className="w-6 h-6" />
                </div>

                {/* Node Info */}
                <div className="mt-4 text-center px-4 w-full">
                  <h4 className="font-bold text-sm text-slate-800 break-words">{node.label}</h4>
                  {node.date ? (
                    <p className="text-xs text-slate-500 mt-1.5">
                      {new Date(node.date).toLocaleString('th-TH', { 
                        day: '2-digit', month: '2-digit', year: '2-digit', 
                        hour: '2-digit', minute: '2-digit' 
                      })} น.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium mt-1.5">
                      {node.by || 'รอดำเนินการ'}
                    </p>
                  )}
                  {node.date && node.by && (
                    <p className="text-xs font-semibold text-slate-600 mt-1">โดย {node.by}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

