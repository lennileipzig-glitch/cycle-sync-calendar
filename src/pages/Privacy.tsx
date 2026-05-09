import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-3xl flex items-center gap-2 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Zurück">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl">Datenschutzerklärung</h1>
        </div>
      </header>
      <main className="container max-w-3xl py-6 prose prose-sm dark:prose-invert max-w-none">
        <article className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">Fravia – Zyklusbasierte Kalender-App (Prototyp für Testzwecke)</h2>
            <p className="text-muted-foreground">Stand: 09. Mai 2026</p>
          </section>

          <section>
            <h3 className="font-semibold">1. Verantwortlicher</h3>
            <p>Verantwortlich für die Verarbeitung personenbezogener Daten im Zusammenhang mit dem Prototyp „Fravia" ist:</p>
            <p>
              Lene Böttcher<br />
              Kormoranweg 10, 39114 Magdeburg, Deutschland<br />
              E-Mail: <a className="underline" href="mailto:fravia@gmx.net">fravia@gmx.net</a><br />
              Website / App: <a className="underline" href="https://fravia.lovable.app/auth" target="_blank" rel="noreferrer">https://fravia.lovable.app/auth</a>
            </p>
          </section>

          <section>
            <h3 className="font-semibold">2. Kurzbeschreibung des Dienstes</h3>
            <p>Fravia ist ein nicht-kommerzieller bzw. vorvertraglicher Prototyp im Bereich Frauengesundheit und zyklusbasierte Alltagsplanung. Der Dienst stellt eine Kalender-App bereit, über die Nutzerinnen ihren Zyklus tracken, Termine planen und personalisierte Empfehlungen für Energie, Sport und Ernährung erhalten können.</p>
            <p>Fravia ersetzt keine medizinische Beratung, keine ärztliche Diagnose und keinen Notfall- oder Krisendienst. Der Prototyp richtet sich ausschließlich an volljährige Testnutzerinnen.</p>
          </section>

          <section>
            <h3 className="font-semibold">3. Welche Daten wir verarbeiten</h3>
            <p>Je nach Nutzung des Prototyps können insbesondere folgende Daten verarbeitet werden:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Registrierungs- und Kontaktdaten:</strong> E-Mail-Adresse, Login-Daten, ggf. Anzeigename, Testnutzer-ID</li>
              <li><strong>Zyklus- und Gesundheitsdaten:</strong> Periodendauer, Zyklusstart, Energielevel, Symptome, Beschwerden, Notizen</li>
              <li><strong>Kalender- und Planungsdaten:</strong> eingetragene Termine, Aufgaben, Mahlzeiten, Sporteinheiten</li>
              <li><strong>Session- und Nutzungsdaten:</strong> Zeitpunkte der Nutzung, Session-IDs, technische Ereignisse, Fehlermeldungen, ungefährer Nutzungsumfang</li>
              <li><strong>Technische Daten:</strong> IP-Adresse, Browser-/Geräteinformationen, Betriebssystem, Server-Logdaten</li>
              <li><strong>Einwilligungs- und Verwaltungsdaten:</strong> Einwilligungsstatus, Widerrufe, Löschanfragen, Support-Kommunikation</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">4. Hinweis zu sensiblen Daten</h3>
            <p>Da Fravia Zyklus- und Gesundheitsdaten verarbeitet, handelt es sich um besonders sensible personenbezogene Daten im Sinne von Art. 9 DSGVO. Wir fordern solche Angaben nicht zwingend an und bitten Nutzerinnen, nur solche Informationen einzugeben, die sie wirklich teilen möchten. Die Verarbeitung erfolgt nur auf Grundlage einer ausdrücklichen Einwilligung.</p>
          </section>

          <section>
            <h3 className="font-semibold">5. Zwecke der Verarbeitung</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bereitstellung der Fravia-App und der Nutzeroberfläche</li>
              <li>Durchführung der Testnutzung, Registrierung, Login und Session-Verwaltung</li>
              <li>Berechnung und Anzeige von Zyklusphasen und personalisierten Empfehlungen</li>
              <li>Speicherung von Kalendereinträgen, Tracking-Daten und Nutzungsverhalten zur Personalisierung</li>
              <li>Produktvalidierung, Fehleranalyse, Sicherheit und technische Stabilisierung des Prototyps</li>
              <li>Bearbeitung von Anfragen, Einwilligungen, Widerrufen und Löschanfragen</li>
              <li>Erfüllung gesetzlicher Pflichten</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">6. Rechtsgrundlagen</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Einwilligung,</strong> Art. 6 Abs. 1 lit. a DSGVO: für die freiwillige Testnutzung und die Verarbeitung von Zyklus- und Gesundheitsdaten</li>
              <li><strong>Ausdrückliche Einwilligung,</strong> Art. 9 Abs. 2 lit. a DSGVO: soweit besondere Kategorien personenbezogener Daten verarbeitet werden</li>
              <li><strong>Vertragsanbahnung oder Nutzungsverhältnis,</strong> Art. 6 Abs. 1 lit. b DSGVO: soweit die Verarbeitung erforderlich ist, um den Prototyp bereitzustellen</li>
              <li><strong>Berechtigte Interessen,</strong> Art. 6 Abs. 1 lit. f DSGVO: für IT-Sicherheit, Fehleranalyse und Stabilität</li>
              <li><strong>Rechtliche Pflichten,</strong> Art. 6 Abs. 1 lit. c DSGVO: soweit gesetzliche Aufbewahrungs- oder Nachweispflichten bestehen</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">7. Einwilligung und Widerruf</h3>
            <p>Die Nutzung des Prototyps ist freiwillig. Nutzerinnen können eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, z. B. per E-Mail an <a className="underline" href="mailto:fravia@gmx.net">fravia@gmx.net</a>. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt.</p>
          </section>

          <section>
            <h3 className="font-semibold">8. Einsatz von Dienstleistern und Weitergabe an Dritte</h3>
            <p>Für Betrieb, Hosting, Datenbank und Authentifizierung können externe Dienstleister eingesetzt werden:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Backend, Hosting und Infrastruktur: Lovable Cloud</li>
              <li>Datenbank: Supabase</li>
              <li>Authentifizierung und E-Mail: Supabase Auth</li>
            </ul>
            <p>Soweit Dienstleister als Auftragsverarbeiter eingesetzt werden, sollen entsprechende Vereinbarungen zur Auftragsverarbeitung abgeschlossen werden.</p>
          </section>

          <section>
            <h3 className="font-semibold">9. Cookies, Local Storage und technische Identifikatoren</h3>
            <p>Der Prototyp kann technisch notwendige Cookies oder Local-Storage-Einträge verwenden, um Login, Session und Grundfunktionen bereitzustellen. Marketing- oder Tracking-Technologien werden nicht eingesetzt.</p>
          </section>

          <section>
            <h3 className="font-semibold">10. Speicherdauer und Löschung</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account- und Registrierungsdaten:</strong> bis zur Löschung des Testaccounts oder bis zum Ende der Testphase; konkrete Frist: 30 Tage nach Ende der Tests bzw. nach Löschanfrage unverzüglich</li>
              <li><strong>Zyklus-, Kalender- und Trackingdaten:</strong> solange die Testnutzung aktiv ist; konkrete Frist: max. 90 Tage nach letzter Nutzung</li>
              <li><strong>Server- und Sicherheitslogs:</strong> regelmäßig kurzfristig, 7 bis 90 Tage</li>
              <li><strong>Backups:</strong> Löschung im Rahmen regulärer Backup-Zyklen; spätestens nach 90 Tagen</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">11. Datensicherheit</h3>
            <p>Wir treffen angemessene technische und organisatorische Maßnahmen, um personenbezogene Daten vor Verlust, Missbrauch und unbefugtem Zugriff zu schützen. Dazu gehören Transportverschlüsselung, Zugriffsbeschränkungen und sichere Authentifizierungsverfahren.</p>
          </section>

          <section>
            <h3 className="font-semibold">12. Rechte der betroffenen Personen</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO)</li>
              <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Löschung personenbezogener Daten (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch gegen Verarbeitungen (Art. 21 DSGVO)</li>
              <li>Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO)</li>
              <li>Beschwerde bei einer Datenschutzaufsichtsbehörde (Art. 77 DSGVO)</li>
            </ul>
            <p>Anfragen können gerichtet werden an: <a className="underline" href="mailto:fravia@gmx.net">fravia@gmx.net</a></p>
          </section>

          <section>
            <h3 className="font-semibold">13. Datenschutzaufsichtsbehörde</h3>
            <p>Für den Verantwortlichen voraussichtlich zuständige Behörde: Landesbeauftragte für den Datenschutz Sachsen-Anhalt.</p>
          </section>

          <section>
            <h3 className="font-semibold">14. Änderungen dieser Datenschutzerklärung</h3>
            <p>Da sich der Prototyp in einer frühen Entwicklungsphase befindet, können sich Funktionen, Dienstleister und Datenflüsse ändern. Diese Datenschutzerklärung wird angepasst, sobald sich wesentliche Änderungen ergeben.</p>
          </section>
        </article>
      </main>
    </div>
  );
}
