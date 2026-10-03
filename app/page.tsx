import DiceRoller from "./components/DiceRoller";
import SystemsGrid from "./components/SystemsGrid";

export default function Page() {
  return (
    <div className="mx-auto max-w-[1120px] px-5">
      <section className="grid items-center gap-10 py-9 md:grid-cols-[1.1fr_1fr] md:py-14">
        <div>
          <h1 className="mb-4 font-heading text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold leading-[1.1]">
            ¿Cansado del papel y boli?
          </h1>
          <p className="max-w-[46ch] text-muted">
            Crea personajes, organiza campañas y tira dados con tu grupo desde el móvil o el ordenador en Roll2Go.
          </p>
        </div>
        <DiceRoller />
      </section>
      <SystemsGrid />
    </div>
  );
}