import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc, arrayRemove, getDoc } from 'firebase/firestore';
import loading from './assets/img/loading.gif'
import { getCityId } from '../fetchData';
import concert from './assets/img/concert.jpeg'

export const UserDashboard = () => {
    const [error, setError] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [results, setResults] = useState([]);
    const [artistArray, setArtistArray] = useState([]);
    const [followingArtists, setFollowingArtists] = useState([]);
    const [city, setCity] = useState('')
    const [state, setState] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        const userId = user.uid;
                        const userRef = doc(db, 'users', userId);
                        const userSnapshot = await getDoc(userRef);

                        if (userSnapshot.exists()) {
                            const userData = userSnapshot.data();
                            setArtistArray(userData.followedArtists || []);
                            setFollowingArtists(userData.followedArtists || []);
                            setCity(userData.city)
                            setState(userData.state)
                        } else {
                            console.log("User not found!");
                        }
                    }
                    setIsLoaded(true);
                });
            } catch (error) {
                setError(error.message);
                setIsLoaded(true);
            }
        };
        fetchData();
    }, []);

    const fetchShows = async (bandName) => {
        const cityCode = await getCityId(city, state)
        try {
            const response = await fetch(`https://www.jambase.com/jb-api/v1/events?artistName=${bandName}&geoCityId=${cityCode}&apikey=${import.meta.env.VITE_REACT_APP_JAMBASE}`);
            if (!response.ok) {
                throw new Error(`${response.status}: ${response.statusText}`);
            }
            const jsonifiedresponse = await response.json();
            return jsonifiedresponse.events;
        } catch (error) {
            throw new Error(error.message);
        }
    };

    const fetchShowsForAllBands = async () => {
        try {
            setIsLoaded(false);
            const allResults = [];

            const fetchShowsForArtist = async (artistName) => {
                try {
                    const bandResults = await fetchShows(artistName);
                    if (bandResults.length < 1) {
                        allResults.push({});
                    } else {
                        allResults.push(bandResults[0]);
                    }
                } catch (error) {
                    setError(error.message);
                }
            };
            for (const artist of artistArray) {
                await fetchShowsForArtist(artist);
            }

            setResults(allResults.flat());
            setIsLoaded(true);
        } catch (error) {
            setError(error.message);
            setIsLoaded(true);
        }
    };

    useEffect(() => {
        fetchShowsForAllBands();
    }, [artistArray]);

    if (!auth.currentUser) {
        return <div>Loading...</div>;
    }

    const formatDate = (dateString) => {
        const options = { month: 'long', day: 'numeric', year: 'numeric' };
        const dateTime = new Date(dateString);
        return dateTime.toLocaleDateString('en-US', options);
    };

    const handleUnfollow = async (artistName) => {
        try {
            const userId = auth.currentUser.uid;
            const userRef = doc(db, 'users', userId);

            await updateDoc(userRef, {
                followedArtists: arrayRemove(artistName)
            });

            setFollowingArtists(prevState => prevState.filter(name => name !== artistName));

            const userSnapshot = await getDoc(userRef);
            if (userSnapshot.exists()) {
                const userData = userSnapshot.data();
            } else {
                console.log("User not found!");
            }
        } catch (error) {
            console.error('Error updating document:', error);
        }
    };

    return (
        <>
            <div id='dashboard'>
                <h1 id='dashboardH1'>UPCOMING SHOWS</h1>
                {isLoaded ? (
                    <table>
                        <thead>
                            <tr>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id='tableBody'>
                            {artistArray.map((artist, index) => {
                                const bandResult = results[index] || {};
                                const formattedDate = bandResult.startDate ? formatDate(bandResult.startDate) : '---';
                                return followingArtists.includes(artist) ? (
                                    <tr key={index}>
                                        <td> <img id='artistThumbnail' src={bandResult.image ? bandResult.image : concert} alt='artist thumbnail' /></td>
                                        <td id='dashboardArtist'>{artist}</td>
                                        <td>{formattedDate}</td>
                                        <td>{bandResult.location ? bandResult.location.name : '---'}</td>
                                        <td>
                                            <button className='button' onClick={() => handleUnfollow(artist)}>Unfollow</button>
                                        </td>
                                    </tr>
                                ) : null;
                            })}
                        </tbody>
                    </table>
                ) : (
                    <img id='dashboardLoad' className='loadingImg' src={loading} alt='loading' />
                )}
            </div>
        </>
    );
};