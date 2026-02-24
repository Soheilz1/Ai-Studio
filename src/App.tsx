/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Settings, 
  Cpu, 
  Activity, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types for calculation results
interface PWMResult {
  timer: number;
  prescaler: number;
  top: number;
  ocr: number;
  frequency: number;
  actualFrequency: number;
  dutyCycle: number;
  actualDutyCycle: number;
  error: string | null;
  registers: {
    name: string;
    value: string;
    description: string;
  }[];
}

export default function App() {
  const [clockFreq, setClockFreq] = useState<number>(16000000);
  const [targetFreq, setTargetFreq] = useState<number>(1000);
  const [dutyCycle, setDutyCycle] = useState<number>(50);
  const [selectedTimer, setSelectedTimer] = useState<number>(1); // Default to Timer 1 (16-bit)

  const calculation = useMemo((): PWMResult => {
    const prescalers = [1, 8, 64, 256, 1024];
    let bestResult: PWMResult | null = null;

    const is16Bit = selectedTimer === 1;
    const maxTop = is16Bit ? 65535 : 255;

    for (const N of prescalers) {
      // Fast PWM formula: F_pwm = F_clk / (N * (1 + TOP))
      // => TOP = (F_clk / (N * F_pwm)) - 1
      const top = Math.round(clockFreq / (N * targetFreq)) - 1;

      if (top > 0 && top <= maxTop) {
        const actualFreq = clockFreq / (N * (1 + top));
        const ocr = Math.round(((top + 1) * dutyCycle) / 100) - 1;
        const actualDuty = ((ocr + 1) / (top + 1)) * 100;

        // Register values (Simplified for ATmega328P)
        const registers = [];
        
        if (selectedTimer === 1) {
          // Timer 1: Mode 14 (Fast PWM with ICR1 as TOP)
          // WGM13:0 = 1110
          // CS12:0 based on prescaler
          const csBits = N === 1 ? '001' : N === 8 ? '010' : N === 64 ? '011' : N === 256 ? '100' : '101';
          registers.push({ name: 'TCCR1A', value: '0x82', description: 'COM1A1=1, WGM11=1 (Fast PWM, Non-inverting)' });
          registers.push({ name: 'TCCR1B', value: `0x1${parseInt(csBits, 2).toString(16)}`, description: `WGM13=1, WGM12=1, CS=${csBits} (Prescaler ${N})` });
          registers.push({ name: 'ICR1', value: `0x${top.toString(16).toUpperCase()}`, description: `TOP value for frequency (${top} decimal)` });
          registers.push({ name: 'OCR1A', value: `0x${Math.max(0, ocr).toString(16).toUpperCase()}`, description: `Duty cycle value (${Math.max(0, ocr)} decimal)` });
        } else {
          // Timer 0 or 2: Mode 7 (Fast PWM with OCRnA as TOP)
          // Note: In this mode, only OCnB is available for PWM
          const csBits = selectedTimer === 0 
            ? (N === 1 ? '001' : N === 8 ? '010' : N === 64 ? '011' : N === 256 ? '100' : '101')
            : (N === 1 ? '001' : N === 8 ? '010' : N === 32 ? '011' : N === 64 ? '100' : N === 128 ? '101' : N === 256 ? '110' : '111');
          
          const tccra = selectedTimer === 0 ? '0x23' : '0x23'; // COMnB1=1, WGMn1=1, WGMn0=1
          const tccrb = `0x0${(8 | parseInt(csBits, 2)).toString(16)}`; // WGMn2=1 + CS bits
          
          registers.push({ name: `TCCR${selectedTimer}A`, value: tccra, description: 'Fast PWM mode, OCnB non-inverting' });
          registers.push({ name: `TCCR${selectedTimer}B`, value: tccrb, description: `WGMn2=1, CS=${csBits} (Prescaler ${N})` });
          registers.push({ name: `OCR${selectedTimer}A`, value: `0x${top.toString(16).toUpperCase()}`, description: `TOP value for frequency (${top} decimal)` });
          registers.push({ name: `OCR${selectedTimer}B`, value: `0x${Math.max(0, ocr).toString(16).toUpperCase()}`, description: `Duty cycle value (${Math.max(0, ocr)} decimal)` });
        }

        bestResult = {
          timer: selectedTimer,
          prescaler: N,
          top,
          ocr: Math.max(0, ocr),
          frequency: targetFreq,
          actualFrequency: actualFreq,
          dutyCycle,
          actualDutyCycle: actualDuty,
          error: null,
          registers
        };
        break; // Found the best prescaler (highest resolution)
      }
    }

    return bestResult || {
      timer: selectedTimer,
      prescaler: 0,
      top: 0,
      ocr: 0,
      frequency: targetFreq,
      actualFrequency: 0,
      dutyCycle,
      actualDutyCycle: 0,
      error: 'فرکانس درخواستی با این تایمر و فرکانس کلاک قابل دستیابی نیست. لطفاً فرکانس یا تایمر را تغییر دهید.',
      registers: []
    };
  }, [clockFreq, targetFreq, dutyCycle, selectedTimer]);

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 font-sans selection:bg-emerald-500/30" dir="rtl">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#151921] px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
            <Cpu className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">محاسبه‌گر PWM ذاتی ATmega328P</h1>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">AVR Timer Configuration Tool</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>SYSTEM READY</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-[#151921] rounded-2xl border border-white/5 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6 text-emerald-400">
              <Settings className="w-5 h-5" />
              <h2 className="font-bold">تنظیمات ورودی</h2>
            </div>

            <div className="space-y-5">
              {/* Clock Frequency */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">فرکانس کلاک (Hz)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={clockFreq}
                    onChange={(e) => setClockFreq(Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                  />
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
                <div className="flex gap-2 mt-2">
                  {[8000000, 16000000, 20000000].map(f => (
                    <button 
                      key={f}
                      onClick={() => setClockFreq(f)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${clockFreq === f ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
                    >
                      {f / 1000000}MHz
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Frequency */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">فرکانس هدف (Hz)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={targetFreq}
                    onChange={(e) => setTargetFreq(Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                  />
                  <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Duty Cycle */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">دیوتی سایکل ({dutyCycle}%)</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="0.1"
                  value={dutyCycle}
                  onChange={(e) => setDutyCycle(Number(e.target.value))}
                  className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Timer Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">انتخاب تایمر</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTimer(t)}
                      className={`py-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${selectedTimer === t ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
                    >
                      <span className="text-xs font-bold">Timer {t}</span>
                      <span className="text-[9px] opacity-60">{t === 1 ? '16-bit' : '8-bit'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Info Card */}
          <section className="bg-blue-500/5 rounded-2xl border border-blue-500/10 p-5">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-xs text-blue-200/70 leading-relaxed">
                برای دستیابی به فرکانس‌های دقیق و رزولوشن بالا، استفاده از <strong className="text-blue-300">Timer 1</strong> پیشنهاد می‌شود. تایمرهای 0 و 2 به دلیل 8 بیتی بودن، در فرکانس‌های پایین محدودیت دارند.
              </p>
            </div>
          </section>

          {/* Hardware Specs Section */}
          <section className="bg-[#151921] rounded-2xl border border-white/5 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              <Cpu className="w-5 h-5" />
              <h2 className="font-bold">مشخصات سخت‌افزاری</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">تعداد تایمرها:</span>
                <span className="text-white font-bold">3 تایمر (2 عدد 8 بیتی، 1 عدد 16 بیتی)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">خروجی‌های PWM:</span>
                <span className="text-white font-bold">6 خروجی (OC0A/B, OC1A/B, OC2A/B)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">رزولوشن تایمر 1:</span>
                <span className="text-white font-bold">16 بیت (65536 پله)</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Status & Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#151921] rounded-2xl border border-white/5 p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg ${calculation.error ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {calculation.error ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">وضعیت خروجی</p>
                <p className={`text-sm font-bold ${calculation.error ? 'text-red-400' : 'text-emerald-400'}`}>
                  {calculation.error ? 'خطا در محاسبه' : 'قابل اجرا'}
                </p>
              </div>
            </div>
            
            <div className="bg-[#151921] rounded-2xl border border-white/5 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">فرکانس واقعی</p>
                <p className="text-sm font-mono font-bold text-white">
                  {calculation.actualFrequency.toLocaleString(undefined, { maximumFractionDigits: 2 })} Hz
                </p>
              </div>
            </div>

            <div className="bg-[#151921] rounded-2xl border border-white/5 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">رزولوشن (TOP)</p>
                <p className="text-sm font-mono font-bold text-white">
                  {calculation.top}
                </p>
              </div>
            </div>
          </div>

          {calculation.error ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center"
            >
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">محدودیت سخت‌افزاری</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                {calculation.error}
              </p>
            </motion.div>
          ) : (
            <>
              {/* Register Values */}
              <section className="bg-[#151921] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm">مقادیر رجیسترها</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">ATmega328P / Arduino Uno</span>
                </div>
                <div className="divide-y divide-white/5">
                  {calculation.registers.map((reg, idx) => (
                    <div key={idx} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-20 font-mono text-emerald-400 font-bold">{reg.name}</div>
                        <div className="bg-black/40 px-3 py-1 rounded font-mono text-white border border-white/5">
                          {reg.value}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        {reg.description}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* PWM Visualization */}
              <section className="bg-[#151921] rounded-2xl border border-white/5 p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm">نمای شماتیک موج PWM</h3>
                </div>
                <div className="h-32 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden flex items-end px-4">
                  <div className="absolute inset-0 grid grid-cols-12 gap-0 opacity-10 pointer-events-none">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="border-r border-white h-full"></div>
                    ))}
                  </div>
                  
                  <div className="flex items-end w-full h-full pb-8">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-end h-16 w-full">
                        <div 
                          className="bg-emerald-500 h-full shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                          style={{ width: `${calculation.dutyCycle}%` }}
                        ></div>
                        <div 
                          className="bg-emerald-500/10 h-[2px] w-full" 
                          style={{ width: `${100 - calculation.dutyCycle}%` }}
                        ></div>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                    <span>0ms</span>
                    <span>زمان (T = { (1000 / calculation.actualFrequency).toFixed(3) } ms)</span>
                    <span>{(5000 / calculation.actualFrequency).toFixed(1)}ms</span>
                  </div>
                </div>
              </section>

              {/* Code Snippet */}
              <section className="bg-[#090B0F] rounded-2xl border border-white/5 p-6 font-mono text-xs overflow-x-auto relative group">
                <div className="absolute top-4 left-4 text-[10px] text-slate-600 uppercase font-bold">C++ / Arduino Code</div>
                <pre className="text-emerald-400/90 leading-relaxed">
                  {`// تنظیمات تایمر ${calculation.timer} برای فرکانس ${calculation.actualFrequency.toFixed(1)}Hz\n`}
                  {`void setup() {\n`}
                  {`  // خروجی کردن پین مربوطه\n`}
                  {calculation.timer === 1 ? `  pinMode(9, OUTPUT); // OC1A\n` : calculation.timer === 0 ? `  pinMode(5, OUTPUT); // OC0B\n` : `  pinMode(3, OUTPUT); // OC2B\n`}
                  {`  \n`}
                  {`  TCCR${calculation.timer}A = 0;\n`}
                  {`  TCCR${calculation.timer}B = 0;\n`}
                  {`  \n`}
                  {calculation.registers.map(reg => `  ${reg.name} = ${reg.value};\n`).join('')}
                  {`}\n\n`}
                  {`void loop() {\n`}
                  {`  // کد اصلی برنامه\n`}
                  {`}`}
                </pre>
                <button 
                  onClick={() => {
                    const code = `void setup() {\n  TCCR${calculation.timer}A = 0;\n  TCCR${calculation.timer}B = 0;\n${calculation.registers.map(reg => `  ${reg.name} = ${reg.value};`).join('\n')}\n}`;
                    navigator.clipboard.writeText(code);
                  }}
                  className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 rounded text-[10px] text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  کپی کد
                </button>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-6 text-center border-t border-white/5 mt-12">
        <p className="text-xs text-slate-500">
          طراحی شده برای مهندسین الکترونیک و توسعه‌دهندگان AVR. تمامی محاسبات بر اساس دیتاشیت رسمی ATmega328P انجام شده است.
        </p>
      </footer>
    </div>
  );
}
