import type { ElementType, ReactNode } from 'react';

type PageContainerWidth = 'wide' | 'content' | 'full';
type PageContainerSpacing = 'compact' | 'default' | 'roomy' | 'detail' | 'none';
type PageContainerAnimation = 'fade' | 'zoom' | 'none';

type PageContainerProps = {
  children: ReactNode;
  width?: PageContainerWidth;
  spacing?: PageContainerSpacing;
  animation?: PageContainerAnimation;
  as?: ElementType;
  className?: string;
};

const widthClasses: Record<PageContainerWidth, string> = {
  wide: 'max-w-[1660px]',
  content: 'max-w-[1440px]',
  full: 'max-w-none',
};

const spacingClasses: Record<PageContainerSpacing, string> = {
  compact: 'space-y-6 py-8',
  default: 'space-y-6 py-4 pb-24 lg:space-y-8 lg:py-8',
  roomy: 'space-y-8 py-4 pb-20 md:py-8',
  detail: 'pb-20',
  none: '',
};

const animationClasses: Record<PageContainerAnimation, string> = {
  fade: 'animate-fade-in',
  zoom: 'animate-in fade-in zoom-in-95 duration-300',
  none: '',
};

export default function PageContainer({
  children,
  width = 'wide',
  spacing = 'default',
  animation = 'fade',
  as: Component = 'div',
  className = '',
}: PageContainerProps) {
  return (
    <Component
      className={`relative mx-auto w-full px-4 md:px-6 xl:px-8 2xl:px-10 ${widthClasses[width]} ${spacingClasses[spacing]} ${animationClasses[animation]} ${className}`}
    >
      {children}
    </Component>
  );
}
