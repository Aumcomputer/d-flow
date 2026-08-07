import React from 'react';
import { Activity, Pill, Building2, Wallet, CheckCircle2 } from 'lucide-react';

export default function TimelineTab({ details }) {
  if (!details || !details.discharge_date) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground bg-white rounded-2xl shadow-sm border border-border">
        ยังไม่มีข้อมูลการ Discharge
      </div>
    );
  }

  const nodes = [];

  // Node 1: Discharge
  nodes.push({
    label: 'Discharge',
    date: details.discharge_date,
    by: details.discharge_by_name || details.discharge_by,
    icon: Activity,
    color: 'bg-blue-500'
  });

  // Node 2: Pharmacy
  if (details.sent_pharmacy_date) {
    nodes.push({
      label: 'ส่งไปห้องยา',
      date: details.sent_pharmacy_date,
      by: details.sent_pharmacy_by_name || details.sent_pharmacy_by,
      icon: Pill,
      color: 'bg-green-500'
    });
  }

  // Node 3: Discharge Center
  if (details.pharmacy_done_date) {
    nodes.push({
      label: 'ห้องยาเสร็จสิ้น + ส่งไปศูนย์จำหน่าย',
      date: details.pharmacy_done_date,
      by: details.pharmacy_done_by_name || details.pharmacy_done_by,
      icon: Building2,
      color: 'bg-purple-500'
    });
  } else if (details.sent_dc_date && !details.sent_pharmacy_date) {
    nodes.push({
      label: 'ส่งไปศูนย์จำหน่าย',
      date: details.sent_dc_date,
      by: details.sent_dc_by_name || details.sent_dc_by,
      icon: Building2,
      color: 'bg-purple-500'
    });
  }

  // Node 4: Finance
  if (details.sent_finance_date) {
    nodes.push({
      label: 'ศูนย์จำหน่ายเสร็จสิ้น + ส่งไปการเงิน',
      date: details.sent_finance_date,
      by: details.sent_finance_by_name || details.sent_finance_by,
      icon: Wallet,
      color: 'bg-amber-500'
    });
  }

  // Node 5: Completed
  if (details.finance_done_date) {
    nodes.push({
      label: 'เสร็จสิ้น (การเงิน)',
      date: details.finance_done_date,
      by: details.finance_done_by_name || details.finance_done_by,
      icon: CheckCircle2,
      color: 'bg-emerald-500'
    });
  } else if (details.dc_done_date && !details.sent_finance_date) {
    nodes.push({
      label: 'เสร็จสิ้น (ศูนย์จำหน่าย)',
      date: details.dc_done_date,
      by: details.dc_done_by_name || details.dc_done_by,
      icon: CheckCircle2,
      color: 'bg-emerald-500'
    });
  }

  const getDuration = (start, end) => {
    const diff = new Date(end) - new Date(start);
    if (diff < 0) return '-';
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours > 0) return `${hours} ชม. ${m} นาที`;
    return `${m} นาที`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
          <Activity className="w-5 h-5 text-blue-500" />
          Timeline การส่งต่อแผนก
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">แสดงลำดับเวลาและระยะเวลารอคอยในแต่ละขั้นตอน</p>
      </div>
      
      <div className="p-8 overflow-x-auto">
        <div className="flex min-w-max items-start pt-4 pb-8">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const hasNext = index < nodes.length - 1;
            const nextNode = hasNext ? nodes[index + 1] : null;
            const waitTime = hasNext ? getDuration(node.date, nextNode.date) : null;

            return (
              <div key={index} className="flex-1 relative flex flex-col items-center min-w-[200px] group">
                {/* Connecting Line */}
                {hasNext && (
                  <div className="absolute top-6 left-[50%] w-full h-1 bg-slate-300 z-0 group-hover:bg-blue-300 transition-colors"></div>
                )}
                
                {/* Wait Time Badge */}
                {hasNext && (
                  <div className="absolute top-2 left-[100%] -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 z-10 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors">
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
                  <p className="text-xs text-slate-500 mt-1.5">
                    {new Date(node.date).toLocaleString('th-TH', { 
                      day: '2-digit', month: '2-digit', year: '2-digit', 
                      hour: '2-digit', minute: '2-digit' 
                    })} น.
                  </p>
                  {node.by && (
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
