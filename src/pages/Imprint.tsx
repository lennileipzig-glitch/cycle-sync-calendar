import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Imprint() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-3xl flex items-center gap-2 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Zurück">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl">Impressum</h1>
        </div>
      </header>
      <main className="container max-w-3xl py-6">
        <article className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">Fravia – Zyklusbasierte Kalender-App (Prototyp für Testzwecke)</h2>
            <p className="text-muted-foreground">Stand: 09. Mai 2026</p>
          </section>

          <section>
            <h3 className="font-semibold">Angaben gemäß § 5 DDG / § 18 MStV</h3>
            <p>
              Lene Böttcher<br />
              Kormoranweg 10<br />
              39114 Magdeburg<br />
              Deutschland
            </p>
          </section>

          <section>
            <h3 className="font-semibold">Kontakt</h3>
            <p>
              E-Mail: <a className="underline" href="mailto:fravia@gmx.net">fravia@gmx.net</a><br />
              Website / App: <a className="underline" href="https://fravia.lovable.app" target="_blank" rel="noreferrer">https://fravia.lovable.app</a>
            </p>
          </section>

          <section>
            <h3 className="font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
            <p>Lene Böttcher, Anschrift wie oben. Hannah Emilia Höpfner und Jana Meyer.</p>
          </section>

          <section>
            <h3 className="font-semibold">Hinweis zum Prototyp</h3>
            <p>Fravia ist ein nicht-kommerzieller bzw. vorvertraglicher Prototyp im Bereich Frauengesundheit und zyklusbasierte Alltagsplanung. Der Dienst dient ausschließlich Test- und Validierungszwecken und richtet sich an volljährige Testnutzerinnen. Fravia ersetzt keine medizinische Beratung, keine ärztliche Diagnose und keinen Notfall- oder Krisendienst.</p>
          </section>

          <section>
            <h3 className="font-semibold">Haftung für Inhalte</h3>
            <p>Als Diensteanbieterin bin ich gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG bin ich als Diensteanbieterin jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
          </section>

          <section>
            <h3 className="font-semibold">Haftung für Links</h3>
            <p>Dieses Angebot kann Links zu externen Websites Dritter enthalten, auf deren Inhalte ich keinen Einfluss habe. Deshalb kann ich für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
          </section>

          <section>
            <h3 className="font-semibold">Urheberrecht</h3>
            <p>Die durch die Betreiberin erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung der jeweiligen Autorin.</p>
          </section>

          <section>
            <h3 className="font-semibold">Streitbeilegung</h3>
            <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a className="underline" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">https://ec.europa.eu/consumers/odr</a>. Ich bin nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
          </section>
        </article>
      </main>
    </div>
  );
}
