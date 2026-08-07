"use client";
import { Button } from "@heroui/button";
import { useEffect, useRef, useState } from "react";
import Redirect from "./Redirect";
type Slide = {
  src: string;
  title?: string;
  description?: string;
  buttonText?: string;
  link?: string;
};

type ImageSliderProps = {
  slides: Slide[];
  autoPlay?: boolean;
  interval?: number;
};

const ImageSlider: React.FC<ImageSliderProps> = ({
  slides,
  autoPlay = true,
  interval = 3000,
}) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = slides.length;
  const goToSlide = (index: number) => {
    if (!sliderRef.current) return;
    const slideWidth = sliderRef.current.children[0].clientWidth;
    sliderRef.current.style.transform = `translateX(-${index * slideWidth}px)`;
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const resetAutoPlay = () => {
    if (!autoPlay) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(nextSlide, interval);
  };

  useEffect(() => {
    goToSlide(currentSlide);
  }, [currentSlide]);

  useEffect(() => {
    if (autoPlay) resetAutoPlay();

    const handleResize = () => goToSlide(currentSlide);
    window.addEventListener("resize", handleResize);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      <div className="w-full relative overflow-hidden rounded-xl">
        {/* SLIDER */}
        <div
          ref={sliderRef}
          className="flex transition-transform duration-500 ease-in-out"
        >
          {slides.map((slide, index) => (
            <div
              key={index}
              className="relative w-full h-90 shrink-0 gradient-to-r from-black to-transparent"
            >
              <img
                src={slide.src}
                className="object-cover h-full w-full"
                alt={`Slide ${index + 1}`}
              />

              {/* TEXT OVERLAY */}
              {(slide.title || slide.description) && (
                <div className="w-full h-full absolute top-0 left-0 flex items-end bg-linear-to-t from-slate-900/90 via-slate-900/40 to-transparent">
                  <div className="absolute bottom-6 left-6 text-white ml-10 flex flex-col max-w-xs">
                    <div>
                      {slide.title && (
                        <h3 className="text-lg font-bold">{slide.title}</h3>
                      )}
                      {slide.description && (
                        <p className="text-sm opacity-90">
                          {slide.description}
                        </p>
                      )}
                    </div>
                    <Redirect to={slide.link || "/"}>
                      <Button
                        variant="shadow"
                        color="primary"
                        className="mt-2 bg-linear-to-r from-indigo-600 to-[#8A7DFF] active:scale-95 w-fit px-4 py-2 rounded-full text-sm"
                      >
                        {slide.buttonText || "Learn More"}
                      </Button>
                    </Redirect>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* LEFT BUTTON */}
        <button
          onClick={() => {
            prevSlide();
            resetAutoPlay();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 md:p-2 p-1 bg-black/30 rounded-full hover:bg-black/50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* RIGHT BUTTON */}
        <button
          onClick={() => {
            nextSlide();
            resetAutoPlay();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 md:p-2 p-1 bg-black/30 rounded-full hover:bg-black/50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </>
  );
};

export default ImageSlider;
