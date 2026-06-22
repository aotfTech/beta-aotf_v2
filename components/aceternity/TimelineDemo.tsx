import { Timeline } from "./ui/timeline";

export function TimelineDemo() {
  const data = [
    {
      title: "One-to-One Tutoring",
      content: (
        <div>
          <p className="mb-4 text-md font-normal text-neutral-800 md:text-sm dark:text-neutral-200">
            Personalized 1:1 tutoring that matches students with verified
            educators for subject-focused learning, exam preparation, and steady
            progress tracking.
          </p>
          <img
            src="https://res.cloudinary.com/dzko1daqg/image/upload/v1782152974/One-to-One_Tutoring_ouqti6.png"
            alt="connect"
            width={500}
            height={500}
            className="h-60 w-full rounded-lg object-contain md:h-44 lg:h-60"
          />
        </div>
      ),
    },
    {
      title: "Batch Tuition & Coaching",
      content: (
        <div>
          <p className="mb-4 text-md font-normal text-neutral-800 md:text-sm dark:text-neutral-200">
            Structured batch classes and coaching — online or in-person — with
            curriculum-aligned lessons, practice material, and performance
            insights.
          </p>
          <p className="mb-4 text-md font-normal text-neutral-800 md:text-sm dark:text-neutral-200">
            Flexible schedules and group learning help students build depth
            while keeping costs accessible.
          </p>
          <img
            src="https://res.cloudinary.com/dzko1daqg/image/upload/v1782152974/Batch_Tuition_Coaching_ge31hv.png"
            alt="batch"
            width={500}
            height={500}
            className="h-60 w-full rounded-lg object-contain md:h-44 lg:h-60"
          />
        </div>
      ),
    },
    {
      title: "Home Tutoring (Doorstep Service)",
      content: (
        <div>
          <p className="mb-4 text-md font-normal text-neutral-800 md:text-sm dark:text-neutral-200">
            Qualified tutors who travel to students' homes, offering safe,
            background-verified, and flexible instruction tailored to each
            learner's needs.
          </p>
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ Verified tutors with background checks
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ Flexible timing and one-off sessions available
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ Progress reports and parent communication
            </div>
          </div>
          <img
            src="https://res.cloudinary.com/dzko1daqg/image/upload/v1782152974/Home_Tutoring_Doorstep_Service_wrqltc.jpg"
            alt="doorstep"
            width={500}
            height={500}
            className="h-60 w-full rounded-lg object-contain md:h-44 lg:h-60"
          />
        </div>
      ),
    },
    {
      title: "Coverage Across Classes, Subjects & Boards",
      content: (
        <div>
          <p className="mb-4 text-md font-normal text-neutral-800 md:text-sm dark:text-neutral-200">
            Courses and tutors across grades, subjects, and examination boards —
            from foundational early learning to competitive exam preparation.
          </p>
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ CBSE, ICSE, State boards, and competitive syllabuses
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ Curriculum-mapped lesson plans and assessments
            </div>
          </div>
          <img
            src="https://res.cloudinary.com/dzko1daqg/image/upload/v1782152974/Coverage_Across_Classes_Subjects_Boards_p3rsgr.avif"
            alt="coverage"
            width={500}
            height={500}
            className="h-60 w-full rounded-lg object-contain md:h-44 lg:h-60"
          />
        </div>
      ),
    },
    {
      title: "Extracurricular & Skill Development",
      content: (
        <div>
          <p className="mb-4 text-md font-normal text-neutral-800 md:text-sm dark:text-neutral-200">
            Clubs, hobby classes, and vocational upskilling — from arts and
            sports to coding and soft skills — to build well-rounded students.
          </p>
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ Hobby classes and clubs
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              ✅ Practical skill-building workshops
            </div>
          </div>
          <img
            src="https://res.cloudinary.com/dzko1daqg/image/upload/v1782152974/Extracurricular_Skill_Development_cxnolo.avif"
            alt="extracurricular"
            width={500}
            height={500}
            className="h-60 w-full rounded-lg object-contain md:h-44 lg:h-60"
          />
        </div>
      ),
    },
  ];
  return <Timeline data={data} />;
}
