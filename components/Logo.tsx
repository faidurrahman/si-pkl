
import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 32, className = "" }) => {
  return (
    <img 
      src="https://drive.google.com/thumbnail?id=1BU0DPMBjVe379MQ7Rczjn3_s4DAEa5L9&sz=w800" 
      alt="SIPAKATAU Logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

export default Logo;
