
import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 32, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded Square Background */}
      <rect width="100" height="100" rx="24" fill="currentColor" />
      
      {/* Stylized "S" and Market/Arrangement Element */}
      <path 
        d="M30 40C30 34.4772 34.4772 30 40 30H60C65.5228 30 70 34.4772 70 40V45C70 50.5228 65.5228 55 60 55H40C34.4772 55 30 59.4772 30 65V70C30 75.5228 34.4772 80 40 80H60C65.5228 80 70 75.5228 70 70" 
        stroke="white" 
        strokeWidth="8" 
        strokeLinecap="round" 
      />
      
      {/* Location/Market Pin Dot */}
      <circle cx="50" cy="55" r="6" fill="white" />
      
      {/* Roof of a stall/shop at the top */}
      <path 
        d="M25 35L50 20L75 35" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Logo;
