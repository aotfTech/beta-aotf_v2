import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Badge } from "@heroui/badge";
import React from "react";

const cities = [
  {
    name: "Kolkata",
    image: "https://images.unsplash.com/photo-1558431382-27e303142255?w=200",
  },
  {
    name: "Howrah",
    image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=200",
  },
  {
    name: "Hooghly",
    image: "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=200",
  },
];

export default function CitySelector() {
  return (
    <Card className="w-full max-w-md rounded-2xl p-5 mx-5">
      {/* Heading */}
      <h2 className="text-center text-2xl font-bold leading-tight text-gray-900">
        We are Live PAN India
      </h2>

      {/* Divider */}
      <div className="my-5 flex items-center justify-center gap-3">
        <div className="h-px flex-1 bg-gray-300" />
        <span className="whitespace-nowrap text-sm text-gray-600">
          Available in{" "}
          <span className="font-semibold text-indigo-600">3+ cities</span>
        </span>
        <div className="h-px flex-1 bg-gray-300" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {cities.map((city) => (
          <button
            key={city.name}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 transition-all duration-200 hover:border-indigo-500 hover:shadow-md"
          >
            <img
              src={city.image}
              alt={city.name}
              className="h-12 w-12 rounded-lg object-cover"
            />

            <span className="text-left text-lg font-semibold text-gray-800">
              {city.name}
            </span>
          </button>
        ))}
        <br />
        <Badge color="primary" content={"Upcoming"} className="">
          <button
            key="bangalore"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 transition-all duration-200 hover:border-indigo-500 hover:shadow-md"
          >
            <img
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200"
              alt="bangalore"
              className="h-12 w-12 rounded-lg object-cover"
            />

            <span className="text-left text-lg font-semibold text-gray-800">
              Bangalore
            </span>
          </button>
        </Badge>
      </div>
    </Card>
  );
}
