import styles from './page.module.css';

export default function Index() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>KANT Labs</div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Trust, A Priori.</h1>
          <p className={styles.subtitle}>
            We create the value that AI can't follow.
          </p>
        </section>

        <section id="ecosystems" className={styles.ecosystemSection}>
          <div className={styles.ecosystemCard}>
            <h2 id="KANTick">The KANTick Ecosystem</h2>
            <p>High-throughput timestamp broadcasting. Powered by robust backend infrastructure and edge computing to stream consensus events in real-time.</p>
          </div>
          <div className={styles.ecosystemCard}>
            <h2 id="KANTist">The KANTist Ecosystem</h2>
            <p>Advanced physical forensics and hardware attestation. Using PRNU and sensor-level analysis to verify the definitive truth of digital images.</p>
          </div>
          <div className={styles.ecosystemCard}>
            <h2 id="KANTician">The KANTician Ecosystem</h2>
            <p>Cryptographic acoustic attestation. Capturing and verifying raw audio environments to establish unalterable sonic truth.</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 KANT Labs. All rights reserved.</p>
      </footer>
    </div>
  );
}
