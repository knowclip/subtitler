import Link from "next/link";
import React from "react"
import css from './imprint.module.scss';

export default function Imprint() {
  return (
    <section className={css.container}>
      <h1 className={css.title}>Impressum</h1>

      <p>justinsilvestre@gmail.com</p>
      <p>
        Justin Silvestre c/o RA Matutis<br />
        Berliner Straße 57<br />
        14467 Potsdam
      </p>
      <p className={css.homeLinkP}><Link href="/">Home</Link></p>
    </section>
  );
}
