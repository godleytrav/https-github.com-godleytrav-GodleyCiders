import React from 'react';
import { motion } from 'motion/react';

const EVENTS = [
  {
    id: 1,
    title: "Orchard Harvest Dinner",
    date: "OCT 14",
    time: "6:30 PM",
    description: "An intimate five-course dinner served under the heritage trees. Featuring seasonal pairings and the first taste of our 2025 Reserve.",
    price: "$145",
    status: "Few tickets left",
    location: "Godley Estate Orchards"
  },
  {
    id: 2,
    title: "The Wild Ferment Release",
    date: "NOV 02",
    time: "7:00 PM",
    description: "Celebrating the launch of Batch #04. Live ambient soundscape, small bites, and guided vertical tasting with the head cidermaker.",
    price: "$65",
    status: "Selling fast",
    location: "The Cellar, Godley"
  },
  {
    id: 3,
    title: "Winter Solstice Tasting",
    date: "DEC 21",
    time: "5:00 PM - 9:00 PM",
    description: "A candlelit evening of spiced warm ciders and rich winter preserves. Club members receive a complimentary limited glass.",
    price: "$40",
    status: "Tickets soon",
    location: "Main Street Tasting Room"
  }
];

export default function Events() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 font-serif">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-24"
      >
        <h1 className="text-5xl md:text-7xl text-amber-500 uppercase tracking-[0.2em] font-light mb-6">Events</h1>
        <div className="w-24 h-[1px] bg-amber-500/30 mx-auto mb-8" />
        <p className="text-stone-400 italic text-lg max-w-xl mx-auto">
          Exclusive gatherings, tasting dinners, and celebrations of the harvest.
        </p>
      </motion.div>

      <div className="space-y-16 lg:space-y-24">
        {EVENTS.map((event, index) => (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
            className="group relative grid md:grid-cols-[1fr_2fr] gap-8 md:gap-16 items-center"
          >
            {/* DATE BOX - Premium Typographic (Recipe 9 style) */}
            <div className="flex flex-col items-center md:items-end justify-center border-b md:border-b-0 md:border-r border-stone-800 pb-8 md:pb-0 md:pr-16 text-center md:text-right">
              <span className="text-[120px] leading-none text-stone-900 border-stone-800 font-bold select-none group-hover:text-amber-500/10 transition-colors">
                {event.id < 10 ? `0${event.id}` : event.id}
              </span>
              <div className="relative -mt-16 z-10 text-amber-500">
                <div className="text-4xl tracking-widest uppercase font-light">{event.date.split(' ')[1]}</div>
                <div className="text-xs tracking-[0.5em] uppercase font-medium opacity-70">{event.date.split(' ')[0]}</div>
              </div>
            </div>

            {/* EVENT INFO */}
            <div className="space-y-6">
              <div className="flex justify-between items-start gap-4">
                <h2 className="text-2xl md:text-4xl text-stone-100 uppercase tracking-widest group-hover:text-amber-500 transition-colors duration-500">
                  {event.title}
                </h2>
                <div className="bg-amber-900/20 border border-amber-500/30 px-3 py-1 rounded text-[10px] text-amber-500 uppercase tracking-widest mt-2 whitespace-nowrap">
                  {event.status}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-amber-500/50 rounded-full" />
                  {event.time}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-amber-500/50 rounded-full" />
                  {event.location}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-amber-500/50 rounded-full" />
                  {event.price}
                </div>
              </div>

              <p className="text-stone-400 italic text-sm leading-relaxed max-w-2xl">
                {event.description}
              </p>

              <button className="relative group px-10 py-3 overflow-hidden border border-amber-500/20 text-amber-500 uppercase tracking-[0.3em] text-[10px] hover:border-amber-500 transition-colors">
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                Reserve Space
              </button>
            </div>

            {/* DECORATIVE LINE */}
            <div className="absolute -bottom-8 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-stone-800/30 to-transparent md:hidden" />
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="mt-32 text-center border-t border-stone-800 pt-16"
      >
        <p className="text-stone-500 text-xs uppercase tracking-[0.3em] mb-4">Want to host a private event?</p>
        <button className="text-stone-300 hover:text-amber-500 transition-colors uppercase tracking-[0.5em] text-[10px] underline underline-offset-8">
          Inquire for private bookings
        </button>
      </motion.div>
    </div>
  );
}
