import { system } from "@/lib/systems";

export default function GamesGrid() {
  return (
    <section id="sistemas">
      <h2 className="section-title">Sistemas</h2>
      <div className="games-grid">
        {system.map((s) => (
          <a className="card game" href="#" key={s.id}>
            <h3>{s.name}</h3>
            <p>{s.text}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
