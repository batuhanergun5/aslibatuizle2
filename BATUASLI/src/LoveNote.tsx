"use client";
import { useRef, useState } from "react";
import { Heart, X } from "lucide-react";

const notes = [
  "Aslı, komik bir sahnede gözüm seni arıyor. Bir de senin gülüşünü görürsem sahne tamamlanıyor.",
  "Günün ortasında aklıma küçücük bir şey geliyor. Daha kendim gülmeden ‘Bunu Aslı’ya anlatayım’ diyorum.",
  "Filmi sen seç. Benim en sevdiğim kısım, başlatmadan hemen önce sesini duyduğum o birkaç saniye.",
  "Aynı koltukta oturamadığımız akşamlar için sana burada yer ayırdım. Tam yanımda.",
  "Aslı, seni çok seviyorum. Bazen bunu söylemek için koca bir site yapasım geliyor. Bu da onlardan biri. ♡",
  "Bir gün bu filmin adını unutabilirim. Seninle izlediğimi hatırlamak bana yeter."
];

export default function LoveNote() {
  const dialog = useRef<HTMLDialogElement>(null);
  const next = useRef(0);
  const [index, setIndex] = useState(0);
  function reveal() {
    setIndex(next.current);
    next.current = (next.current + 1) % notes.length;
    if (!dialog.current?.open) dialog.current?.showModal();
  }
  return <>
    <button className="secret-heart" type="button" aria-label="Aslı’ya bir not aç" title="Aslı’ya…" onClick={reveal}><Heart size={19}/></button>
    <dialog className="love-letter" ref={dialog} aria-labelledby="letter-title" onClick={e=>{if(e.target===e.currentTarget) dialog.current?.close()}}>
      <article>
        <button type="button" className="letter-close" aria-label="Notu kapat" onClick={()=>dialog.current?.close()}><X size={19}/></button>
        <Heart className="seal" size={26}/>
        <h2 id="letter-title">Aslı’m,</h2>
        <p aria-live="polite">{notes[index]}</p>
        <div className="signature">Batu</div>
        <button type="button" className="next-note" onClick={reveal}>Bir not daha <Heart size={14}/></button>
      </article>
    </dialog>
  </>;
}
