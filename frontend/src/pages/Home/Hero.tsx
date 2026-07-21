import Container from "../../components/ui/container";
import Button from "../../components/ui/Button";

export default function Hero() {
  return (
    <section className="py-28">
      <Container>
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          <div>
            <h1 className="text-6xl md:text-7xl font-bold leading-tight text-white">
              Think.
              <br />
              Sketch.
              <br />
              Collaborate.
              <br />
              <span className="text-violet-500">
                In Real Time.
              </span>
            </h1>

            <p className="mt-8 text-zinc-400 text-lg max-w-xl">
              VisualBoard is a collaborative whiteboard
              built for teams, designers, developers,
              and creators.
            </p>

            <div className="flex gap-4 mt-10">
              <Button>
                Get Started Free
              </Button>

              <Button variant="secondary">
                Watch Demo
              </Button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl h-[500px] flex items-center justify-center">
            <span className="text-zinc-500">
              Whiteboard Preview
            </span>
          </div>

        </div>
      </Container>
    </section>
  );
}