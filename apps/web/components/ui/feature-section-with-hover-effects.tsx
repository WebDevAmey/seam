import { cn } from "@/lib/utils";
import {
  IconAlertTriangle,
  IconChartBar,
  IconLink,
  IconMessage,
  IconMessageChatbot,
  IconRobot,
  IconSend,
  IconShieldCheck,
} from "@tabler/icons-react";

export function FeaturesSectionWithHoverEffects() {
  const features = [
    {
      title: "Leak detection",
      description: "Finds payment blocks, issuer downtime, silent abandons, and pre-checkout drops.",
      icon: <IconAlertTriangle />,
    },
    {
      title: "Diagnosis agent",
      description: "Reads Razorpay's decline reasons and figures out why a payment actually failed.",
      icon: <IconRobot />,
    },
    {
      title: "Shield",
      description: "Seven safety checks stand between any action and your customer. No exceptions.",
      icon: <IconShieldCheck />,
    },
    {
      title: "Recovery executor",
      description: "Sends a real payment link only when it clears the profitability bar.",
      icon: <IconSend />,
    },
    {
      title: "Leak intelligence",
      description: "Flags a payment method the moment its failure rate spikes above normal.",
      icon: <IconChartBar />,
    },
    {
      title: "Conversation agent",
      description: "Reads customer replies and knows when to stop, hold, or hand off to a human.",
      icon: <IconMessage />,
    },
    {
      title: "Hash-chained ledger",
      description: "Every action is recorded and verifiable, live, from any browser.",
      icon: <IconLink />,
    },
    {
      title: "Chat with your store",
      description: "Ask plain questions about your own leaks and recovery data, get real answers.",
      icon: <IconMessageChatbot />,
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 py-10 max-w-7xl mx-auto border border-neutral-200 rounded-xl overflow-hidden">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r py-10 relative group/feature border-neutral-200 transition-colors duration-300",
        (index === 0 || index === 4) && "lg:border-l",
        index < 4 && "lg:border-b",
        "hover:bg-blue-500"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-0 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-transparent to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-0 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-transparent to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-500 group-hover/feature:text-white transition-colors duration-300">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 group-hover/feature:bg-white transition-all duration-300 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-300 inline-block text-black group-hover/feature:text-white">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 group-hover/feature:text-white/80 max-w-xs relative z-10 px-10 transition-colors duration-300">
        {description}
      </p>
    </div>
  );
};
