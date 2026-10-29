import { curriculum } from '$data/questions';

export interface TrackQuestion {
	id: string;
	title: string;
}

export interface TrackQuestions {
	/** Id of the Part (the /questions/[partId] page) the question belongs to. */
	partId: string | null;
	/** The track's own title, from its meta.json. */
	track: string | null;
	questions: TrackQuestion[];
}

// Every question in the same track as `id`, in the order /questions lists
// them -- the IDE header's quick-nav drawer shows these. Read from the same
// catalogue the Questions pages use, so the drawer, its title and the back
// arrow's destination can never disagree with them. Scoped to one track
// rather than the whole curriculum so each prerendered page only carries
// that track's titles.
export function getTrackQuestions(id: string): TrackQuestions {
	for (const part of curriculum) {
		for (const track of part.tracks) {
			if (!track.questions.some((q) => q.slug === id)) continue;
			return {
				partId: part.id,
				track: track.name,
				questions: track.questions.map(({ slug, title }) => ({ id: slug, title }))
			};
		}
	}
	return { partId: null, track: null, questions: [] };
}
