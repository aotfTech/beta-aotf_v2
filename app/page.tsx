import ReknownedSection from "@/components/ReknownedSection";
import OurServices from "@/components/OurServices";
import Testimonials from "@/components/Testimonials";
import ImageSlider from "@/components/ImageSlider";
import HeroDescription from "@/components/HeroDescription";
import Counter from "@/components/Counter";
import { TimelineDemo } from "@/components/aceternity/TimelineDemo";
import Footer from "@/components/Footer";
import LeadershipCard from "@/components/home/LeadershipCard";
import { Card } from "@heroui/card";
import AdPlacementSlot from "@/components/AdPlacementSlot";

export default function Home() {
  return (
    <>
      <section className="flex w-full flex-col items-center justify-center">
        {/* <HeroSection /> */}
        {/* <ImagesSliderDemo /> */}
        <ImageSlider
          slides={[
            {
              src: "https://res.cloudinary.com/dzko1daqg/image/upload/v1780142208/img1_wiaiwl.jpg",
              title: "Find a Tutor",
              // description in 5 -6 words
              description: "Discover personalized learning with trusted tutors",
              buttonText: "Find Tuitions",
              link: "/posts",
            },
            {
              src: "https://res.cloudinary.com/dzko1daqg/image/upload/v1780142208/img2_lxwpcc.jpg",
              title: "Hire a Freelancer",
              description:
                "Connect with verified freelancers for your projects",
              buttonText: "Find Jobs",
              link: "/jobs",
            },
            {
              src: "https://res.cloudinary.com/dzko1daqg/image/upload/v1780142208/img3_hsphm0.jpg",
              title: "Join as Educator",
              description: "Share your knowledge and earn by teaching students",
              buttonText: "Join Now",
              link: "/sign-up",
            },
          ]}
          autoPlay
          interval={3000}
        />
        <HeroDescription />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Counter label="Active users" start={628} />
          <Counter label="Teachers" start={2768} />
          <Counter label="Freelancers" start={842} />
          <Counter label="Success Rate" start={89} suffix="%" float />
        </div>
        <Card
          isBlurred
          className="grid grid-cols-1 gap-3 p-2 border-none bg-background/60 dark:bg-default-100/50 max-w-152.5 mt-10"
          shadow="sm"
        >
          <LeadershipCard
            name="Tutu Rani Ghosh"
            role="Founder"
            image="./founder.jpeg"
            quote="Vision drives everything."
          />
          <LeadershipCard
            name="Soumyadip Ghosh"
            role="CEO"
            image="./ceo.jpeg"
            quote="Execution is key to success."
          />
        </Card>
        <OurServices />
        <AdPlacementSlot placement="home_banner" />
        <ReknownedSection />
        <TimelineDemo />
        <Testimonials />
        {/* <Stats /> */}
        {/* <ScrollBanner /> */}
        <AdPlacementSlot placement="footer" />
      </section>
      <Footer />
    </>
  );
}
