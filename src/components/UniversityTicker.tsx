"use client";

import Image from "next/image";

const UNIVERSITIES = [
  { name: "Harvard University", src: "/uni/harvard.png", width: 150, height: 10 },
  { name: "MIT", src: "/uni/mit.avif", width: 100, height: 10 },
  { name: "Stanford University", src: "/uni/standford.avif", width: 150, height: 16 },
  { name: "University of Cambridge", src: "/uni/cambridge.png", width: 180, height: 28 },
  { name: "University of Oxford", src: "/uni/oxford.avif", width: 140, height: 16 },
  { name: "Cornell University", src: "/uni/cornell.png", width: 70, height: 12 },
  { name: "University of Pennsylvania", src: "/uni/penn.png", width: 140, height: 16 },
  { name: "University of Chicago", src: "/uni/logo-uchicago.png", width: 150, height: 12 },
  { name: "NUS", src: "/uni/nus.png", width: 120, height: 10 },
  { name: "UNSW", src: "/uni/unsw.png", width: 110, height: 12 },
];

const tickerItems = [...UNIVERSITIES, ...UNIVERSITIES];

export default function UniversityTicker() {
  return (
    <section
      aria-label="University logos"
      className="university-ticker-mask overflow-hidden bg-white py-10"
    >
      <div className="university-ticker-track flex w-max items-center gap-0">
        {tickerItems.map((uni, index) => (
          <div
            key={`${uni.name}-${index}`}
            className="group mx-12 flex h-24 items-center justify-center opacity-60 transition-all duration-300 hover:opacity-100"
          >
            <div
              className="relative flex w-auto items-center"
              style={{ height: `${uni.height * 0.25}rem` }}
            >
              <Image
                src={uni.src}
                alt={uni.name}
                width={uni.width}
                height={uni.height}
                className="h-full w-auto grayscale transition duration-300 group-hover:grayscale-0"
                unoptimized
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
