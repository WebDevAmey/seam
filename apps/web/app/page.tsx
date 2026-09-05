import SiteMotion from "@/components/landing/SiteMotion";
import { NavBar } from "@/components/landing/NavBar";
import { CinematicFooter } from "@/components/landing/sections/CinematicFooterClient";
import { IntegrationStrip } from "@/components/landing/sections/IntegrationStrip";
import { ProblemContrast } from "@/components/landing/sections/ProblemContrast";
import { WhySeamSections } from "@/components/landing/sections/WhySeamSections";
import { HowItWorksSections } from "@/components/landing/sections/HowItWorksSections";
import { LandingHero } from "@/components/landing/sections/LandingHero";
import { FeaturesSectionWithHoverEffects } from "@/components/ui/feature-section-with-hover-effects";

const pillars = [
  {
    num: "01",
    title: "Finds the leak",
    desc: "Seam checks every checkout, every payment attempt, and every method's failure rate. Each leak is classified live, into one of six known causes.",
  },
  {
    num: "02",
    title: "Decides what's worth doing",
    desc: "A recovery message only goes out if the math says it's worth it, and Shield's seven safety checks all pass.",
  },
  {
    num: "03",
    title: "Proves what it did",
    desc: "Every action Seam takes, or blocks, is recorded on a verifiable chain. You can check it any time.",
  },
];

export default function Home() {
  return (
    <div className="landing-root">
      <SiteMotion />
      <a
        className="fixed left-4 top-4 z-100 py-2.5 px-3.5 rounded-lg bg-accent-saffron-deep text-white font-bold -translate-y-[140%] transition-transform duration-180 ease-custom focus:translate-y-0"
        href="#main"
      >
        Skip to content
      </a>
      <div className="relative z-2 overflow-x-hidden">
        <NavBar />

        <main id="main">
          <LandingHero />
          <IntegrationStrip />

          <section className="bg-bg-secondary" aria-labelledby="problem-title" id="problem">
            <div className="py-28 w-[calc(100%-24px)] sm:w-[calc(100%-32px)] max-w-[1180px] mx-auto">
              <span className="inline-block mb-4.5 py-1 px-3 rounded-full bg-accent-saffron-light text-accent-saffron-deep text-xs font-bold uppercase tracking-wider">
                The Problem
              </span>
              <div className="grid grid-cols-1 min-[861px]:grid-cols-2 gap-10 min-[861px]:gap-16 items-start mt-12">
                <div className="reveal">
                  <h2 id="problem-title" className="font-serif text-[1.5rem] font-semibold sm:text-7xl leading-[0.94] m-0 text-text-primary">
                    You don&apos;t have a payments problem. You have a{" "}
                    <em className="text-accent-saffron-deep italic">seam</em> problem.
                  </h2>
                </div>
                <ProblemContrast />
              </div>
            </div>
          </section>

          <section className="bg-bg-primary py-28" id="how-it-works-pillars" aria-labelledby="pillars-title">
            <div className="w-[calc(100%-24px)] sm:w-[calc(100%-32px)] max-w-[1180px] mx-auto">
              <div className="max-w-[720px] mb-16 reveal">
                <span className="inline-block mb-4.5 py-1 px-3 rounded-full bg-accent-saffron-light text-accent-saffron-deep text-xs font-bold uppercase tracking-wider">
                  How It Works
                </span>
                <h2 id="pillars-title" className="font-serif text-[1.875rem] sm:text-5xl font-semibold leading-[0.96] text-text-primary m-0">
                  One pipeline. Three jobs.
                </h2>
              </div>
              <div className="grid grid-cols-1 min-[861px]:grid-cols-3 gap-6">
                {pillars.map((pillar) => (
                  <article key={pillar.num} className="reveal flex flex-col rounded-2xl p-7 border-[1.5px] border-border-primary bg-white">
                    <p className="font-mono text-5xl font-black leading-none text-accent-saffron mb-5">{pillar.num}</p>
                    <h3 className="font-sans text-lg font-bold text-text-primary mb-2.5">{pillar.title}</h3>
                    <p className="text-text-secondary text-[15px] leading-relaxed m-0">{pillar.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white py-10 border-t border-border-primary" id="features" aria-labelledby="features-title">
            <div className="w-[calc(100%-24px)] sm:w-[calc(100%-32px)] max-w-[1180px] mx-auto">
              <div className="max-w-[720px] pt-18 reveal">
                <span className="inline-block mb-4.5 py-1 px-3 rounded-full bg-accent-teal-light text-accent-teal-deep text-xs font-bold uppercase tracking-wider">
                  Features
                </span>
                <h2 id="features-title" className="font-serif text-[1.875rem] sm:text-[clamp(36px,5vw,68px)] leading-[0.96] text-text-primary m-0">
                  Everything Seam does, in one place.
                </h2>
              </div>
              <FeaturesSectionWithHoverEffects />
            </div>
          </section>

          <section className="bg-bg-dark py-28" id="agents" aria-labelledby="moat-title">
            <div className="w-[calc(100%-24px)] sm:w-[calc(100%-32px)] max-w-[1180px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-20 items-center">
                <div className="reveal">
                  <span className="inline-block mb-4.5 py-1 px-3 rounded-full bg-white/12 text-text-on-dark text-xs font-bold uppercase tracking-wider">
                    The Agent Fleet
                  </span>
                  <h2 id="moat-title" className="font-serif text-[36px] sm:text-[clamp(36px,5vw,68px)] leading-[0.96] text-text-on-dark mt-2 mb-7">
                    Named agents, not <em>a black box.</em>
                  </h2>
                  <p className="text-text-on-dark-soft text-[clamp(17px,1.6vw,22px)] leading-normal m-0 mb-9">
                    Eight automated workers, each named for what it actually does. Seven run on plain
                    code, no model involved. Click into any agent to see its real run history.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { num: "01", label: "Leak Detector · deterministic" },
                      { num: "02", label: "Diagnosis Agent · LLM-assisted" },
                      { num: "03", label: "Shield · fail-closed, no override" },
                      { num: "04", label: "Store Chat Agent · LLM-assisted" },
                    ].map((item) => (
                      <div className="p-[18px_20px] border border-border-dark rounded-lg bg-white/4" key={item.num}>
                        <span className="block mb-1.5 font-mono text-[11px] text-accent-saffron font-bold uppercase tracking-widest">{item.num}</span>
                        <span className="text-text-on-dark text-[15px] font-semibold">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-6 sm:max-lg:grid-cols-2 reveal" data-delay="100">
                  <div className="p-8 border border-accent-saffron/20 rounded-2xl bg-accent-saffron/5">
                    <span className="block font-sans text-[22px] font-bold text-accent-saffron leading-tight mb-2">Honestly disclosed</span>
                    <p className="text-text-on-dark-soft text-base leading-normal m-0">
                      Most agents here are plain code, not a model. We show it that way instead of
                      calling everything &ldquo;AI.&rdquo;
                    </p>
                  </div>
                  <div className="p-8 border border-accent-saffron/20 rounded-2xl bg-accent-saffron/5">
                    <span className="block font-sans text-[22px] font-bold text-accent-saffron leading-tight mb-2">Nothing is a black box</span>
                    <p className="text-text-on-dark-soft text-base leading-normal m-0">
                      Every run, deterministic or LLM-assisted, saves a real record of its input,
                      output, and duration. Click in and see exactly what happened.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <WhySeamSections />
          <HowItWorksSections />
        </main>
      </div>
      <CinematicFooter />
    </div>
  );
}
