"use client";

import { useEffect, useState } from "react";

export function VideoBackground() {
  const [currentVideo, setCurrentVideo] = useState(0);
  
  // List of videos in your public folder - using the correct file names
  const videos = [
    "/videos/video2.mp4",
    "/videos/video3.mp4", 
    "/videos/video1.mp4",
    "/videos/video4.mp4"
  ];

  useEffect(() => {
    // Select a random video on component mount
    const randomIndex = Math.floor(Math.random() * videos.length);
    setCurrentVideo(randomIndex);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        key={videos[currentVideo]}
        autoPlay
        muted
        loop
        playsInline
        className="absolute min-w-full min-h-full w-auto h-auto object-cover"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translateX(-50%) translateY(-50%)",
          minWidth: "100%",
          minHeight: "100%",
          width: "auto",
          height: "auto",
          zIndex: -1,
        }}
      >
        <source src={videos[currentVideo]} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="absolute inset-0 bg-black/40"></div>
    </div>
  );
}
