import type React from "react";
import { useEffect, useState } from "react";

interface CountdownProps {
  time: number; // Time in seconds
}

const Countdown: React.FC<CountdownProps> = ({ time }) => {
  const [secondsLeft, setSecondsLeft] = useState(time);

  useEffect(() => {
    setSecondsLeft(time); // Reset timer when `time` prop changes

    if (time <= 0) return; // Don't start a timer if time is 0 or less

    const interval = setInterval(() => {
      setSecondsLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(interval); // Stop the timer when it reaches 0
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [time]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  return (
    <div
      style={{
        fontSize: "32px",
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        color: secondsLeft <= 10 ? "#ef4444" : "inherit",
        animation: secondsLeft > 0 && secondsLeft <= 10 ? "pulse-glow 1s infinite" : "none",
        borderRadius: 12,
      }}
    >
      {formatTime(secondsLeft)}
    </div>
  );
};

export default Countdown;
