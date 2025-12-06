import React from 'react';

interface StatCardProps {
    title: string;
    value: string;
    icon?: React.ElementType;
    gradient: string;
    glowing?: boolean;
    glowingColor?: 'green' | 'red';
    onClick?: () => void;
}

export const StatCard = ({
    title,
    value,
    icon: Icon,
    gradient,
    glowing = false,
    glowingColor = 'green',
    onClick
}: StatCardProps) => {
    const glowClass = glowing ? (glowingColor === 'green' ? 'glowing-border-green' : 'glowing-border-red') : '';
    const valueColor = glowing ? (glowingColor === 'green' ? 'text-green-700' : 'text-red-700') : 'text-text-primary';

    return (
        <div
            onClick={onClick}
            className={`flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 border ${gradient} hover:scale-[1.02] transition-all duration-300 ${glowClass} ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium leading-normal">{title}</p>
                {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            </div>
            <p className={`tracking-light text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
        </div>
    );
};
