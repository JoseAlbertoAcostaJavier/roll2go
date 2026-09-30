import DiceRoller from "./components/DiceRoller";
import GamesGrid from "./components/GamesGrid";
export default function Page() {
  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <h1>¿Cansado del papel y boli?</h1>
          <p>Crea personajes, organiza campañas y tira dados con tu grupo desde el móvil o el ordenador en Roll2Go.</p>
        </div>
        <DiceRoller />
      </section>
      <GamesGrid />
    </div>
  );
}