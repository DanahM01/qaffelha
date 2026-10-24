import { useState } from 'react';
import Logo, { PhonesArt, XIcon } from '../theme/Logo.jsx';

export default function JoinScreen({ host, initialCode, busy, error, onSubmit, onBack, clearError }) {
  const [code, setCode] = useState(initialCode);
  const [step, setStep] = useState(initialCode || host ? 'name' : 'code');
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  const message = validation || error;
  function submit(event) {
    event.preventDefault();
    if (busy) return;
    const normalizedCode = code.trim().toUpperCase();
    if (!host && !/^[A-HJ-NP-Z]{4}$/.test(normalizedCode)) { setValidation('اكتب كود الغرفة من 4 حروف'); return; }
    if (step === 'code') { setCode(normalizedCode); setValidation(''); setStep('name'); return; }
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 15) { setValidation('اكتب اسم من 1 إلى 15 حرف'); return; }
    onSubmit({ code: normalizedCode, name: trimmed, host });
  }
  return <form className="q-stack q-grow" onSubmit={submit} noValidate>
    <div className="q-spread"><button type="button" className="q-btn q-btn--ghost" onClick={onBack}>رجوع</button><Logo size={40} /></div>
    <div className="q-tv"><span className="q-tv__antenna" />
      <div className="q-tv__screen"><div className="q-stack q-center">
        {host ? <><span className="q-mode__art"><PhonesArt /></span><h1 className="q-title">أنت المضيف</h1></> : <><Logo size={66} /><h1 className="q-title">{step === 'code' ? 'ادخل الغرفة' : 'لقيت الغرفة!'}</h1></>}
      </div></div>
      <div className="q-tv__panel"><span className="q-tv__grille" /><span className="q-tv__led" /><span className="q-tv__knob" /><span className="q-tv__knob" /></div>
    </div>
    {step === 'code' ? <div className="q-field"><label className="q-label" htmlFor="room-code">كود الغرفة</label><p className="q-muted">الكود عند المضيف</p>
      <input id="room-code" className="q-input q-input--code q-input--led" value={code} maxLength={4} autoCapitalize="characters" autoComplete="off" spellCheck={false} dir="ltr"
        aria-describedby={message ? 'join-error' : undefined} aria-invalid={Boolean(message)}
        onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/\s/g, '')); setValidation(''); clearError(); }} />
    </div> : <>
      {!host && <div className="q-spread"><span className="q-badge q-badge--ink q-ltr">{code}</span>
        <button type="button" className="q-btn q-btn--ghost" onClick={() => { setStep('code'); setValidation(''); clearError(); }}>غيّر الكود</button></div>}
      <div className="q-field"><label className="q-label" htmlFor="player-name">وش اسمك؟</label>
        <input id="player-name" className="q-input q-m-name" value={name} maxLength={15} autoComplete="nickname" autoFocus aria-invalid={Boolean(message)}
          aria-describedby={message ? 'join-error' : undefined} onChange={(event) => { setName(event.target.value); setValidation(''); clearError(); }} />
      </div>
    </>}
    {message && <p id="join-error" className="q-field__error" role="alert"><XIcon />{message}</p>}
    <div className="q-grow" />
    <button type="submit" className={`q-btn q-btn--primary q-btn--lg q-btn--block ${busy ? 'is-loading' : ''}`} disabled={busy}>{step === 'code' ? 'التالي' : host ? 'افتح الغرفة' : 'ادخل'}</button>
  </form>;
}
